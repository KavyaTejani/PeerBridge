import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTransfer } from '../hooks/useTransfer';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../lib/crypto';
import { SenderPeer } from '../lib/peer';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import FileDropZone from '../components/FileDropZone';
import FileList from '../components/FileList';
import PasswordInput from '../components/PasswordInput';
import TextArea from '../components/TextArea';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import { LinkIcon, CopyIcon, CheckIcon } from '../lib/icons';

const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || "http://localhost:3001";

// Priority order used to summarise several receivers into one badge.
const STATUS_PRIORITY = ['transferring', 'connecting', 'connected', 'done', 'error'];

function overallStatus(receivers, creating) {
  if (creating) return 'connecting';
  const statuses = Object.values(receivers).map(r => r.status);
  return STATUS_PRIORITY.find(s => statuses.includes(s)) || 'idle';
}

function percent(done, total) {
  return total > 0 ? Math.round((done / total) * 100) : 100;
}

export default function SharePage() {
  const { user } = useAuth();
  const { setSocket, resetTransfer } = useTransfer();

  const [files, setFiles] = useState([]);
  const [textContent, setTextContent] = useState("");
  const [password, setPassword] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  // { [peerId]: { label, status, reason, progress: { [fileIndex]: pct } } }
  const [receivers, setReceivers] = useState({});

  // Refs, not state: the unmount cleanup below must see the live objects,
  // not the null values captured on first render.
  const socketRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerRef.current) peerRef.current.destroy();
      resetTransfer();
    };
  }, []);

  const handleFilesSelected = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const updateReceiver = (peerId, update) => {
    setReceivers(prev => {
      const current = prev[peerId] || {
        label: `Receiver ${Object.keys(prev).length + 1}`,
        status: 'idle',
        progress: {}
      };
      return { ...prev, [peerId]: { ...current, ...update(current) } };
    });
  };

  const createRoom = async () => {
    if (!password) return alert("Please set a password");
    if (files.length === 0 && !textContent) return alert("Add some files or text");

    setError(null);
    setCreating(true);

    const pHash = await hashPassword(password);
    const newRoomId = uuidv4().replace(/-/g, "").slice(0, 12);
    const sentFiles = files;
    const sentText = textContent;

    const newSocket = io(SIGNAL_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect_error", () => {
      // Only fatal before the room exists; afterwards socket.io retries itself.
      if (peerRef.current) return;
      setError("Can't reach the signaling server. Please try again.");
      setCreating(false);
      newSocket.disconnect();
    });

    const meta = {
      files: sentFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
      totalSize: sentFiles.reduce((acc, f) => acc + f.size, 0),
      hasText: !!sentText
    };

    newSocket.emit("create-room", { roomId: newRoomId, passwordHash: pHash, meta }, (res) => {
      if (!res || res.status !== "ok") {
        setError(res?.error || "Could not create the room. Please try again.");
        setCreating(false);
        newSocket.disconnect();
        return;
      }

      const senderPeer = new SenderPeer({
        socket: newSocket,
        roomId: newRoomId,
        iceServers: res.iceServers, // Use ICE servers from server
        files: sentFiles,
        textContent: sentText,
        onStatusChange: (peerId, status, reason) => {
          updateReceiver(peerId, () => ({ status, reason }));
          if (status === 'done' && user) logTransfer(newRoomId, sentFiles);
        },
        onProgress: (peerId, idx, sent, total) => {
          const pct = percent(sent, total);
          updateReceiver(peerId, r => ({ progress: { ...r.progress, [idx]: pct } }));
        }
      });

      peerRef.current = senderPeer;
      setRoomId(newRoomId);
      setCreating(false);

      newSocket.on("peer-joined", ({ peerId }) => {
        senderPeer.createOffer(peerId);
      });

      newSocket.on("peer-left", ({ peerId }) => {
        senderPeer.removePeer(peerId);
      });

      newSocket.on("answer", ({ answer, from }) => {
        senderPeer.handleAnswer(from, answer);
      });

      newSocket.on("ice-candidate", ({ candidate, from }) => {
        senderPeer.addIceCandidate(from, candidate);
      });
    });
  };

  const logTransfer = async (loggedRoomId, sentFiles) => {
    try {
      await addDoc(collection(db, 'transfers'), {
        uid: user.uid,
        roomId: loggedRoomId,
        direction: 'sent',
        files: sentFiles.map(f => ({ name: f.name, size: f.size })),
        totalSize: sentFiles.reduce((acc, f) => acc + f.size, 0),
        createdAt: serverTimestamp(),
        status: 'completed'
      });
    } catch (e) {
      console.error("Failed to log transfer:", e);
      alert("Firestore Error: " + e.message);
    }
  };

  const transferStatus = overallStatus(receivers, creating);
  const receiverList = Object.entries(receivers);
  const doneCount = receiverList.filter(([, r]) => r.status === 'done').length;

  const receiverProgress = (r) => {
    if (r.status === 'done') return 100;
    if (files.length === 0) return 0;
    return Object.values(r.progress).reduce((a, b) => a + b, 0) / files.length;
  };

  const shareUrl = `${window.location.origin}/receive/${roomId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center max-w-6xl w-full mx-auto">
        <Link to="/dashboard" className="text-2xl font-bebas text-accent tracking-widest">PEERBRIDGE</Link>
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="text-xs font-mono font-bold text-gray-400 hover:text-accent uppercase">History</Link>
          <img src={user?.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.04)] border border-gray-100"
          >
            {!roomId ? (
              <div className="space-y-6">
                <header>
                  <h2 className="text-3xl font-bebas text-gray-900 tracking-wide">SHARE CONTENT</h2>
                  <p className="text-gray-500 text-sm mt-1">Directly from your browser to another.</p>
                </header>

                <FileDropZone onFilesSelected={handleFilesSelected} files={files} />
                
                {files.length > 0 && <FileList files={files} />}

                <TextArea value={textContent} onChange={setTextContent} />
                
                <PasswordInput value={password} onChange={setPassword} />

                {error && <p className="text-red-500 text-xs font-mono text-center">{error}</p>}

                <button
                  onClick={createRoom}
                  disabled={creating}
                  className="w-full bg-accent text-white py-4 rounded-2xl font-bold text-sm tracking-widest hover:opacity-90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
                >
                  {creating ? 'GENERATING...' : 'CREATE SECURE LINK'}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <header className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bebas text-gray-900 tracking-wide">READY TO SYNC</h2>
                    <p className="text-gray-500 text-sm mt-1">Share the link and keep this tab open.</p>
                  </div>
                  <StatusBadge status={transferStatus} />
                </header>

                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3 truncate mr-4">
                    <LinkIcon className="w-5 h-5 text-accent flex-shrink-0" />
                    <span className="text-sm font-mono text-gray-600 truncate">{shareUrl}</span>
                  </div>
                  <button onClick={copyLink} className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-accent">
                    {copied ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
                  </button>
                </div>

                <AnimatePresence>
                  {receiverList.map(([peerId, r]) => (
                    <motion.div key={peerId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <ProgressBar
                        progress={receiverProgress(r)}
                        status={r.status}
                        label={`${r.label}: ${r.status === 'error' ? (r.reason || 'failed') : r.status}`}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {doneCount > 0 && (
                  <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex items-center space-x-4 text-green-700">
                    <CheckIcon className="w-6 h-6" />
                    <span className="font-medium">
                      Delivered to {doneCount} receiver{doneCount === 1 ? '' : 's'}. Keep this tab open to share with more.
                    </span>
                  </div>
                )}

                <div className="pt-4">
                  <button onClick={() => window.location.reload()} className="text-xs font-mono font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest">
                    Terminate Session
                  </button>
                </div>
              </div>
            )}
          </motion.div>
          
          <p className="text-center mt-8 text-gray-400 text-xs font-mono uppercase tracking-widest">
            {roomId ? "Sender Protection: Tab will warn before closing" : "No server storage • End-to-end encryption"}
          </p>
        </div>
      </main>
    </div>
  );
}
