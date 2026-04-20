import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileIcon, UploadIcon, DownloadIcon, CheckIcon } from '../lib/icons';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, sent: 0, received: 0 });

  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'transfers'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransfers(list);
      
      const s = list.reduce((acc, t) => {
        acc.total++;
        if (t.direction === 'sent') acc.sent++;
        else acc.received++;
        return acc;
      }, { total: 0, sent: 0, received: 0 });
      setStats(s);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to transfers:", error);
      setLoading(false);
    });

    // Clean up listener on unmount
    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await deleteDoc(doc(db, 'transfers', id));
      setTransfers(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting transfer:", error);
    }
  };

  const handleUpdateNote = async (id, currentNote) => {
    const newNote = window.prompt("Enter a note for this transfer:", currentNote || "");
    if (newNote === null) return;
    try {
      await updateDoc(doc(db, 'transfers', id), { note: newNote });
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, note: newNote } : t));
    } catch (error) {
      console.error("Error updating note:", error);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#fafafa] p-6 lg:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center space-x-6">
            <img src={user?.photoURL} alt="Avatar" className="w-16 h-16 rounded-3xl border-2 border-accent/20" />
            <div>
              <h1 className="text-3xl font-bebas text-gray-900 tracking-wide">HI, {user?.displayName?.split(' ')[0].toUpperCase()}</h1>
              <p className="text-sm font-mono text-gray-500 uppercase tracking-tighter">Your PeerBridge Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="px-6 py-3 bg-accent text-white rounded-2xl font-medium hover:opacity-90 transition-all shadow-lg shadow-accent/20">
              Start Sharing
            </Link>
            <button onClick={logout} className="px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl font-medium hover:bg-gray-50 transition-all">
              Sign Out
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: "TOTAL TRANSFERS", value: stats.total, icon: <CheckIcon className="w-6 h-6" /> },
            { label: "FILES SENT", value: stats.sent, icon: <UploadIcon className="w-6 h-6" /> },
            { label: "FILES RECEIVED", value: stats.received, icon: <DownloadIcon className="w-6 h-6" /> },
          ].map((s, idx) => (
            <div key={idx} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-6">
              <div className="p-4 bg-accent/5 text-accent rounded-2xl">{s.icon}</div>
              <div>
                <p className="text-[10px] font-mono font-bold text-gray-400 tracking-widest uppercase">{s.label}</p>
                <p className="text-3xl font-bebas text-gray-900 mt-1">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* History Table */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bebas text-gray-800 tracking-wider">TRANSFER HISTORY</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-8 py-4 font-mono">Type</th>
                  <th className="px-8 py-4 font-mono">Content</th>
                  <th className="px-8 py-4 font-mono">Size</th>
                  <th className="px-8 py-4 font-mono">Date</th>
                  <th className="px-8 py-4 font-mono">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="5" className="px-8 py-20 text-center font-mono text-gray-400 animate-pulse">Scanning records...</td></tr>
                ) : transfers.length === 0 ? (
                  <tr><td colSpan="5" className="px-8 py-20 text-center font-mono text-gray-400">No transfers found yet.</td></tr>
                ) : transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      {t.direction === 'sent' ? (
                        <div className="flex items-center text-accent"><UploadIcon className="w-4 h-4 mr-2" /> <span className="text-[10px] font-bold uppercase tracking-tighter">SENT</span></div>
                      ) : (
                        <div className="flex items-center text-blue-500"><DownloadIcon className="w-4 h-4 mr-2" /> <span className="text-[10px] font-bold uppercase tracking-tighter">RCVD</span></div>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-medium text-gray-800 truncate max-w-[250px]">
                        {t.files?.map(f => f.name).join(', ') || 'Text only'}
                      </p>
                      {t.note && <p className="text-xs text-accent font-mono mt-1"># {t.note}</p>}
                    </td>
                    <td className="px-8 py-6 text-sm font-mono text-gray-500">
                      {formatBytes(t.totalSize)}
                    </td>
                    <td className="px-8 py-6 text-xs font-mono text-gray-400">
                      {t.createdAt?.toDate().toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleUpdateNote(t.id, t.note)} className="text-xs font-bold text-gray-400 hover:text-accent font-mono uppercase">Note</button>
                        <button onClick={() => handleDelete(t.id)} className="text-xs font-bold text-gray-400 hover:text-red-500 font-mono uppercase">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
