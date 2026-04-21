const CHUNK_SIZE = 256 * 1024; // 256KB
const MAX_BUFFER = 2 * 1024 * 1024; // 2MB

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export class SenderPeer {
  constructor({ socket, roomId, iceServers, onStatusChange, onProgress }) {
    this.socket = socket;
    this.roomId = roomId;
    this.iceServers = iceServers || [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
    ];
    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.pc = null;
    this.dc = null;
    this.receivers = new Map(); // Map<peerId, { pc, dc, pendingCandidates: [] }>
  }

  async createOffer(peerId) {
    this.onStatusChange('connecting');
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const dc = pc.createDataChannel("fileTransfer", { ordered: true });
    
    this.receivers.set(peerId, { pc, dc, pendingCandidates: [] });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit("ice-candidate", { candidate: e.candidate, roomId: this.roomId, to: peerId });
      }
    };

    dc.onopen = () => {
      this.onStatusChange('connected');
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit("offer", { offer, roomId: this.roomId, to: peerId });
  }

  async handleAnswer(peerId, answer) {
    const peer = this.receivers.get(peerId);
    if (peer) {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      while (peer.pendingCandidates.length > 0) {
        const candidate = peer.pendingCandidates.shift();
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
      }
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

  async sendFiles(peerId, files, textContent) {
    const peer = this.receivers.get(peerId);
    if (!peer || !peer.dc || peer.dc.readyState !== 'open') return;

    const dc = peer.dc;
    const sendJson = (obj) => dc.send(JSON.stringify(obj));

    try {
      this.onStatusChange('transferring');
      sendJson({ cmd: "meta-all", fileCount: files.length, hasText: !!textContent });

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
            while (dc.bufferedAmount > MAX_BUFFER) {
              await sleep(50);
            }
            dc.send(chunk.buffer);
            offset += chunk.length;
            this.onProgress(i, offset, file.size);
          }
        }
        sendJson({ cmd: "file-done", index: i });
        await sleep(100);
      }

      if (textContent) {
        sendJson({ cmd: "text", content: textContent });
      }

      sendJson({ cmd: "all-done" });
      this.onStatusChange('done');

    } catch (error) {
      console.error("Transfer error:", error);
      this.onStatusChange('error');
    }
  }

  destroy() {
    this.receivers.forEach(({ pc, dc }) => {
      dc.close();
      pc.close();
    });
    this.receivers.clear();
  }
}

export class ReceiverPeer {
  constructor({ socket, roomId, iceServers, sessionId, onStatusChange, onFileReceived, onProgress, onTextReceived, onAllDone }) {
    this.socket = socket;
    this.roomId = roomId;
    this.iceServers = iceServers || [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
    ];
    this.sessionId = sessionId;
    this.onStatusChange = onStatusChange;
    this.onFileReceived = onFileReceived;
    this.onProgress = onProgress;
    this.onTextReceived = onTextReceived;
    this.onAllDone = onAllDone;

    this.pc = null;
    this.currentFileMeta = null;
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.pendingCandidates = [];
    
    this._init();
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
  }

  async handleOffer(offer) {
    this.onStatusChange('connecting');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.socket.emit("answer", { answer, roomId: this.roomId });

    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
    }
  }

  async addIceCandidate(candidate) {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  setupDataChannel(channel) {
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      this.onStatusChange('connected');
    };

    channel.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);
        this.handleCommand(msg);
      } else {
        this.receivedChunks.push(e.data);
        this.receivedBytes += e.data.byteLength;
        if (this.currentFileMeta) {
          this.onProgress(this.currentFileMeta.index, this.receivedBytes, this.currentFileMeta.size);
        }
      }
    };
  }

  async handleCommand(msg) {
    switch (msg.cmd) {
      case 'meta-all':
        this.onStatusChange('transferring');
        break;
      case 'meta-file':
        this.currentFileMeta = msg;
        this.receivedChunks = [];
        this.receivedBytes = 0;
        break;
      case 'file-done':
        const blob = new Blob(this.receivedChunks, { type: this.currentFileMeta.type });
        const arrayBuffer = await blob.arrayBuffer();
        this.onFileReceived(msg.index, { 
          name: this.currentFileMeta.name, 
          type: this.currentFileMeta.type, 
          arrayBuffer: arrayBuffer 
        });
        this.currentFileMeta = null;
        this.receivedChunks = [];
        break;
      case 'text':
        this.onTextReceived(msg.content);
        break;
      case 'all-done':
        this.onStatusChange('done');
        this.onAllDone();
        break;
    }
  }

  destroy() {
    if (this.pc) this.pc.close();
  }
}
