import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTransfer } from '../hooks/useTransfer';
import { io } from 'socket.io-client';
import { hashPassword } from '../lib/crypto';
import { ReceiverPeer } from '../lib/peer';
import { saveFile, clearSession } from '../lib/idb';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

import PasswordInput from '../components/PasswordInput';
import FileList from '../components/FileList';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import { LockIcon, DownloadIcon, CheckIcon, SpinnerIcon } from '../lib/icons';

const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || "http://localhost:3001";

export default function ReceivePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, setSocket, transferStatus, setTransferStatus, progress, setProgress, resetTransfer } = useTransfer();

  const [password, setPassword] = useState("");
  const [roomMeta, setRoomMeta] = useState(null);
  const [verified, setVerified] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [receivedText, setReceivedText] = useState("");
  const [peer, setPeer] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if room exists and get meta
    fetch(`${SIGNAL_URL}/room/${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.exists) {
          navigate('/404');
        } else {
          setRoomMeta(data.meta);
        }
      })
      .catch(() => setError("Failed to connect to signaling server"));

    return () => {
      if (socket) socket.disconnect();
      if (peer) peer.destroy();
      resetTransfer();
    };
  }, [roomId]);

  const handleJoin = async () => {
    setError(null);
    const pHash = await hashPassword(password);
    const newSocket = io(SIGNAL_URL);
    setSocket(newSocket);

    newSocket.emit("join-room", { roomId, passwordHash: pHash }, (res) => {
      if (res.error) {
        setError(res.error);
        newSocket.disconnect();
        return;
      }

      setVerified(true);
      setTransferStatus('idle');

      const receiverPeer = new ReceiverPeer({
        socket: newSocket,
        roomId: roomId,
        sessionId: roomId,
        onStatusChange: (s) => setTransferStatus(s),
        onProgress: (idx, received, total) => {
          const pct = Math.round((received / total) * 100);
          setProgress(prev => ({ ...prev, [idx]: pct }));
        },
        onFileReceived: async (idx, fileData) => {
          await saveFile(roomId, idx, fileData);
          setReceivedFiles(prev => [...prev, { ...fileData, index: idx }]);
        },
        onTextReceived: (text) => setReceivedText(text),
        onAllDone: () => {
          setTransferStatus('done');
          if (user) logTransfer(res.meta);
        }
      });

      setPeer(receiverPeer);

      newSocket.on("offer", ({ offer }) => {
        receiverPeer.handleOffer(offer);
      });

      newSocket.on("ice-candidate", ({ candidate }) => {
        receiverPeer.addIceCandidate(candidate);
      });

      newSocket.on("host-left", () => {
        setTransferStatus('error');
        setError("Sender has disconnected.");
      });
    });
  };

  const logTransfer = async (meta) => {
    try {
      await addDoc(collection(db, 'transfers'), {
        uid: user.uid,
        roomId,
        direction: 'received',
        files: meta.files.map(f => ({ name: f.name, size: f.size })),
        totalSize: meta.totalSize,
        createdAt: serverTimestamp(),
        status: 'completed'
      });
    } catch (e) {
      console.error("Failed to log transfer:", e);
    }
  };

  const downloadFile = (idx) => {
    const file = receivedFiles.find(f => f.index === idx);
    if (!file) return;
    const blob = new Blob([file.data], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalProgress = roomMeta?.files?.length 
    ? Object.values(progress).reduce((a, b) => a + b, 0) / roomMeta.files.length 
    : 0;

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.04)] border border-gray-100"
        >
          {!verified ? (
            <div className="space-y-6">
              <header className="text-center mb-8">
                <div className="inline-block p-4 bg-accent/5 text-accent rounded-3xl mb-4">
                  <LockIcon className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bebas text-gray-900 tracking-wide">SECURE ACCESS</h2>
                <p className="text-gray-500 text-sm mt-1">This bridge is password protected.</p>
              </header>

              {roomMeta && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs font-mono text-gray-500">
                  <span>{roomMeta.files.length} FILES</span>
                  <span>{(roomMeta.totalSize / (1024 * 1024)).toFixed(1)} MB TOTAL</span>
                </div>
              )}

              <PasswordInput value={password} onChange={setPassword} placeholder="Enter room password" />
              
              {error && <p className="text-red-500 text-xs font-mono text-center">{error}</p>}

              <button
                onClick={handleJoin}
                className="w-full bg-accent text-white py-4 rounded-2xl font-bold text-sm tracking-widest hover:opacity-90 transition-all shadow-xl shadow-accent/20"
              >
                JOIN BRIDGE
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <header className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bebas text-gray-900 tracking-wide">INCOMING DATA</h2>
                  <p className="text-gray-500 text-sm mt-1">Establishing peer-to-peer connection...</p>
                </div>
                <StatusBadge status={transferStatus} />
              </header>

              <AnimatePresence>
                {transferStatus === 'transferring' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <ProgressBar progress={totalProgress} />
                  </motion.div>
                )}
              </AnimatePresence>

              {receivedText && (
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs font-mono font-bold text-gray-400 mb-2 uppercase">Message</p>
                  <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">{receivedText}</p>
                </div>
              )}

              {roomMeta && (
                <FileList 
                  files={roomMeta.files} 
                  progress={progress} 
                  showDownload={transferStatus === 'done' || receivedFiles.length > 0} 
                  onDownload={downloadFile} 
                />
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-mono border border-red-100">
                  {error}
                </div>
              )}

              {transferStatus === 'done' && (
                <div className="pt-4 flex flex-col items-center">
                  <CheckIcon className="w-12 h-12 text-green-500 mb-4" />
                  <p className="font-bebas text-2xl text-gray-900">TRANSFER COMPLETE</p>
                  <p className="text-gray-500 text-sm mt-1">Files have been safely received.</p>
                  <button onClick={() => navigate('/dashboard')} className="mt-6 text-xs font-mono font-bold text-accent hover:underline uppercase">Go to History</button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
