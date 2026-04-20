import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WarningIcon } from '../lib/icons';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="inline-block p-6 bg-red-50 text-red-500 rounded-[2.5rem] mb-8">
          <WarningIcon className="w-16 h-16" />
        </div>
        <h1 className="text-6xl font-bebas text-gray-900 tracking-wider">BRIDGE DISCONNECTED</h1>
        <p className="text-gray-500 font-mono text-sm mt-4 mb-10 leading-relaxed uppercase tracking-tighter">
          The link you're looking for doesn't exist or has expired. Connections are ephemeral.
        </p>
        <Link 
          to="/" 
          className="inline-block bg-accent text-white px-10 py-4 rounded-2xl font-bold text-sm tracking-widest hover:opacity-90 transition-all shadow-xl shadow-accent/20"
        >
          GO TO HOME
        </Link>
      </motion.div>
    </div>
  );
}
