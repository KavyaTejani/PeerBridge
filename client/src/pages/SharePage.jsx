import React, { useState, useEffect, useCallback } from 'react';
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

export default function SharePage() {
  const { user } = useAuth();
  const { socket, setSocket, transferStatus, setTransferStatus, progress, setProgress, resetTransfer } = useTransfer();
  
  const [files, setFiles] = useState([]);
  const [textContent, setTextContent] = useState("");
  const [password, setPassword] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [peer, setPeer] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
      if (peer) peer.destroy();
      resetTransfer();
    };
  }, []);

  const handleFilesSelected = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const createRoom = async () => {
    if (!password) return alert("Please set a password");
    if (files.length === 0 && !textContent) return alert("Add some files or text");

    setTransferStatus('connecting');
    const newSocket = io(SIGNAL_URL);
    setSocket(newSocket);

    const pHash = await hashPassword(password);
    const newRoomId = uuidv4().replace(/-/g, "").slice(0, 12);
    
    const meta = {
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
      totalSize: files.reduce((acc, f) => acc + f.size, 0),
      hasText: !!textContent
    };

    newSocket.emit("create-room", { roomId: newRoomId, passwordHash: pHash, meta }, (res) => {
      if (res.status === "ok") {
        setRoomId(newRoomId);
        setTransferStatus('idle');
        
        const senderPeer = new SenderPeer({
          socket: newSocket,
          roomId: newRoomId,
          iceServers: res.iceServers, // Use ICE servers from server
          onStatusChange: (s) => setTransferStatus(s),
          onProgress: (idx, sent, total) => {
            const pct = Math.round((sent / total) * 100);
            setProgress(prev => ({ ...prev, [idx]: pct }));
          }
        });

        setPeer(senderPeer);

        newSocket.on("peer-joined", ({ peerId }) => {
          senderPeer.createOffer(peerId);
        });

        newSocket.on("answer", ({ answer, from }) => {
          senderPeer.handleAnswer(from, answer);
        });

        newSocket.on("ice-candidate", ({ candidate, from }) => {
          senderPeer.addIceCandidate(from, candidate);
        });

        newSocket.on("host-left", () => {
          alert("Connection lost");
          window.location.reload();
        });
      }
    });
  };

  useEffect(() => {
    if (transferStatus === 'connected' && peer) {
      // Assuming single receiver for now, get first from Map
      const peerId = Array.from(peer.receivers.keys())[0];
      if (peerId) peer.sendFiles(peerId, files, textContent);
    }
  }, [transferStatus]);

  useEffect(() => {
    if (transferStatus === 'done' && user) {
      logTransfer();
    }
  }, [transferStatus]);

  const logTransfer = async () => {
    try {
      console.log("Attempting to log transfer to Firestore...", { uid: user.uid, roomId });
      await addDoc(collection(db, 'transfers'), {
        uid: user.uid,
        roomId,
        direction: 'sent',
        files: files.map(f => ({ name: f.name, size: f.size })),
        totalSize: files.reduce((acc, f) => acc + f.size, 0),
        createdAt: serverTimestamp(),
        status: 'completed'
      });
      console.log("Transfer logged successfully!");
    } catch (e) {
      console.error("Failed to log transfer:", e);
      alert("Firestore Error: " + e.message);
    }
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

                <button
                  onClick={createRoom}
                  disabled={transferStatus === 'connecting'}
                  className="w-full bg-accent text-white py-4 rounded-2xl font-bold text-sm tracking-widest hover:opacity-90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
                >
                  {transferStatus === 'connecting' ? 'GENERATING...' : 'CREATE SECURE LINK'}
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
                  {transferStatus === 'transferring' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <ProgressBar progress={Object.values(progress).reduce((a, b) => a + b, 0) / files.length} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {transferStatus === 'done' && (
                  <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex items-center space-x-4 text-green-700">
                    <CheckIcon className="w-6 h-6" />
                    <span className="font-medium">Transfer completed successfully!</span>
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
