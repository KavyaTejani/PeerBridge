const CHUNK_SIZE = 256 * 1024; // 256KB
const MAX_BUFFER = 2 * 1024 * 1024; // 2MB
const CONNECT_TIMEOUT_MS = 30 * 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Safety-net defaults only. The signaling server is the source of truth for
// ICE config and passes the full list (including TURN) through the create-room
// / join-room acks. These STUN entries exist just so a misconfigured server
// doesn't leave the peer with zero candidates on trivial NATs.
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" }
];

const FINAL_STATES = new Set(['done', 'error']);

/**
 * Sender side. Keeps one RTCPeerConnection per receiver and reports status and
 * progress per receiver, so several receivers never overwrite each other.
 *
 * Callbacks:
 *   onStatusChange(peerId, status, reason?)
 *   onProgress(peerId, fileIndex, bytesSent, fileSize)
 */
export class SenderPeer {
  constructor({ socket, roomId, iceServers, files, textContent, onStatusChange, onProgress }) {
    this.socket = socket;
    this.roomId = roomId;
    this.iceServers = iceServers || DEFAULT_ICE_SERVERS;
    this.files = files || [];
    this.textContent = textContent || "";
    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.receivers = new Map(); // Map<peerId, { pc, dc, pendingCandidates, status, timer, closed }>
  }

  _setStatus(peerId, status, reason) {
    const peer = this.receivers.get(peerId);
    if (!peer || peer.closed) return;
    peer.status = status;
    this.onStatusChange(peerId, status, reason);
  }

  _fail(peerId, reason) {
    const peer = this.receivers.get(peerId);
    if (!peer || peer.closed || FINAL_STATES.has(peer.status)) return;
    console.warn(`[PeerBridge] Transfer to ${peerId} failed: ${reason}`);
    clearTimeout(peer.timer);
    this._setStatus(peerId, 'error', reason);
  }

  async createOffer(peerId) {
    if (this.receivers.has(peerId)) this.removePeer(peerId);

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const dc = pc.createDataChannel("fileTransfer", { ordered: true });
    const peer = { pc, dc, pendingCandidates: [], status: 'connecting', timer: null, closed: false };
    this.receivers.set(peerId, peer);
    this.onStatusChange(peerId, 'connecting');

    peer.timer = setTimeout(() => {
      if (peer.status === 'connecting') this._fail(peerId, 'Timed out connecting to receiver');
    }, CONNECT_TIMEOUT_MS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit("ice-candidate", { candidate: e.candidate, roomId: this.roomId, to: peerId });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this._fail(peerId, 'Peer connection failed');
    };

    dc.onopen = () => {
      clearTimeout(peer.timer);
      this._setStatus(peerId, 'connected');
      // Each receiver gets its own send as soon as its channel opens.
      this.sendFiles(peerId);
    };

    dc.onclose = () => this._fail(peerId, 'Data channel closed before the transfer finished');
    dc.onerror = () => this._fail(peerId, 'Data channel error');

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("offer", { offer, roomId: this.roomId, to: peerId });
    } catch (e) {
      this._fail(peerId, `Could not create offer: ${e.message}`);
    }
  }

  async handleAnswer(peerId, answer) {
    const peer = this.receivers.get(peerId);
    if (!peer) return;
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      while (peer.pendingCandidates.length > 0) {
        const candidate = peer.pendingCandidates.shift();
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
      }
    } catch (e) {
      this._fail(peerId, `Invalid answer: ${e.message}`);
    }
  }

  async addIceCandidate(peerId, candidate) {
    const peer = this.receivers.get(peerId);
    if (peer) {
      if (peer.pc.remoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
      } else {
        peer.pendingCandidates.push(candidate);
      }
    }
  }

  async sendFiles(peerId) {
    const peer = this.receivers.get(peerId);
    if (!peer || !peer.dc || peer.dc.readyState !== 'open') return;

    const dc = peer.dc;
    const files = this.files;
    const ensureOpen = () => {
      if (peer.closed || dc.readyState !== 'open') throw new Error('Data channel closed');
    };
    const sendJson = (obj) => { ensureOpen(); dc.send(JSON.stringify(obj)); };

    try {
      this._setStatus(peerId, 'transferring');
      sendJson({ cmd: "meta-all", fileCount: files.length, hasText: !!this.textContent });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        sendJson({ cmd: "meta-file", name: file.name, size: file.size, type: file.type || "application/octet-stream", index: i });

        const reader = file.stream().getReader();
        let offset = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          for (let pos = 0; pos < value.length; pos += CHUNK_SIZE) {
            const chunk = value.slice(pos, pos + CHUNK_SIZE);
            // Backpressure; bail out instead of spinning forever if the channel dies.
            while (dc.bufferedAmount > MAX_BUFFER) {
              ensureOpen();
              await sleep(50);
            }
            ensureOpen();
            dc.send(chunk.buffer);
            offset += chunk.length;
            this.onProgress(peerId, i, offset, file.size);
          }
        }
        sendJson({ cmd: "file-done", index: i });
        this.onProgress(peerId, i, file.size, file.size);
      }

      if (this.textContent) {
        sendJson({ cmd: "text", content: this.textContent });
      }

      sendJson({ cmd: "all-done" });
      this._setStatus(peerId, 'done');

    } catch (error) {
      this._fail(peerId, error.message || 'Transfer error');
    }
  }

  /** Called when a receiver leaves the room; tears down its connection. */
  removePeer(peerId) {
    const peer = this.receivers.get(peerId);
    if (!peer) return;
    this._fail(peerId, 'Receiver disconnected');
    peer.closed = true;
    clearTimeout(peer.timer);
    if (peer.dc) peer.dc.close();
    if (peer.pc) peer.pc.close();
    this.receivers.delete(peerId);
  }

  destroy() {
    this.receivers.forEach((peer) => {
      peer.closed = true;
      clearTimeout(peer.timer);
      if (peer.dc) peer.dc.close();
      if (peer.pc) peer.pc.close();
    });
    this.receivers.clear();
  }
}

/**
 * Receiver side.
 *
 * Callbacks:
 *   onStatusChange(status, reason?)
 *   onProgress(fileIndex, bytesReceived, fileSize)
 *   onFileReceived(fileIndex, { name, type, arrayBuffer })  (may be async)
 *   onTextReceived(text)
 *   onAllDone()
 */
export class ReceiverPeer {
  constructor({ socket, roomId, iceServers, sessionId, onStatusChange, onFileReceived, onProgress, onTextReceived, onAllDone }) {
    this.socket = socket;
    this.roomId = roomId;
    this.iceServers = iceServers || DEFAULT_ICE_SERVERS;
    this.sessionId = sessionId;
    this.onStatusChange = onStatusChange;
    this.onFileReceived = onFileReceived;
    this.onProgress = onProgress;
    this.onTextReceived = onTextReceived;
    this.onAllDone = onAllDone;

    this.pc = null;
    this.status = 'idle';
    this.destroyed = false;
    this.allReceived = false;
    this.currentFileMeta = null;
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.pendingCandidates = [];
    // Slow async work (blob -> ArrayBuffer, IndexedDB writes) runs on this
    // queue so it stays in order without blocking incoming chunks.
    this.queue = Promise.resolve();
    this.timer = null;

    this._init();
  }

  _setStatus(status, reason) {
    if (this.destroyed) return;
    this.status = status;
    this.onStatusChange(status, reason);
  }

  _fail(reason) {
    if (this.destroyed || FINAL_STATES.has(this.status)) return;
    console.warn(`[PeerBridge] Receive failed: ${reason}`);
    clearTimeout(this.timer);
    this._setStatus('error', reason);
  }

  _enqueue(task) {
    this.queue = this.queue
      .then(task)
      .catch((e) => this._fail(`Failed to process received data: ${e.message}`));
  }

  _init() {
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit("ice-candidate", { candidate: e.candidate, roomId: this.roomId });
      }
    };
    this.pc.ondatachannel = (e) => {
      this.setupDataChannel(e.channel);
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed' && !this.allReceived) this._fail('Connection to sender failed');
    };
    this.timer = setTimeout(() => {
      if (this.status === 'idle' || this.status === 'connecting') {
        this._fail('Timed out connecting to sender');
      }
    }, CONNECT_TIMEOUT_MS);
  }

  async handleOffer(offer) {
    this._setStatus('connecting');
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.socket.emit("answer", { answer, roomId: this.roomId });

      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
      }
    } catch (e) {
      this._fail(`Could not answer sender: ${e.message}`);
    }
  }

  async addIceCandidate(candidate) {
    if (this.pc && this.pc.remoteDescription) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  setupDataChannel(channel) {
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      clearTimeout(this.timer);
      this._setStatus('connected');
    };
    channel.onclose = () => {
      // Sender may close right after all-done while we are still saving files.
      if (!this.allReceived) this._fail('Connection to sender was lost');
    };
    channel.onerror = () => this._fail('Data channel error');

    // Handled synchronously so chunk/command ordering is exactly the wire order.
    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          console.warn('[PeerBridge] Ignoring malformed control message');
          return;
        }
        this.handleCommand(msg);
      } else {
        if (!this.currentFileMeta) return; // stray chunk, not part of any file
        this.receivedChunks.push(e.data);
        this.receivedBytes += e.data.byteLength;
        this.onProgress(this.currentFileMeta.index, this.receivedBytes, this.currentFileMeta.size);
      }
    };
  }

  handleCommand(msg) {
    switch (msg.cmd) {
      case 'meta-all':
        this._setStatus('transferring');
        break;

      case 'meta-file':
        this.currentFileMeta = msg;
        this.receivedChunks = [];
        this.receivedBytes = 0;
        break;

      case 'file-done': {
        // Take ownership of this file's data and reset state *before* any
        // await, so the next file's meta/chunks can't be wiped by this one.
        const meta = this.currentFileMeta;
        const chunks = this.receivedChunks;
        this.currentFileMeta = null;
        this.receivedChunks = [];
        this.receivedBytes = 0;
        if (!meta) break;

        const blob = new Blob(chunks, { type: meta.type });
        this.onProgress(meta.index, meta.size, meta.size);
        this._enqueue(async () => {
          const arrayBuffer = await blob.arrayBuffer();
          await this.onFileReceived(meta.index, { name: meta.name, type: meta.type, arrayBuffer });
        });
        break;
      }

      case 'text':
        this._enqueue(() => this.onTextReceived(msg.content));
        break;

      case 'all-done':
        this.allReceived = true;
        // Queued so "done" is only reported after every file has been saved.
        this._enqueue(() => {
          if (this.status === 'error') return;
          this._setStatus('done');
          this.onAllDone();
        });
        break;
    }
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    if (this.pc) this.pc.close();
  }
}
