import React from 'react';
import { motion } from 'framer-motion';

export default function ProgressBar({ progress, label, status }) {
  // progress: 0 to 100
  return (
    <div className="w-full space-y-2 mt-4">
      <div className="flex justify-between items-end">
        <span className="text-sm font-medium text-gray-700">{label || "Transfer Progress"}</span>
        <span className="text-xs font-mono text-accent">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${status === 'error' ? 'bg-red-500' : 'bg-accent'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
