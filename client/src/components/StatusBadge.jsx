import React from 'react';

const STATUS_CONFIG = {
  idle:         { text: "Waiting",      bg: "bg-gray-100",   textCol: "text-gray-600" },
  connecting:   { text: "Connecting",   bg: "bg-blue-100",   textCol: "text-blue-600" },
  connected:    { text: "Linked",       bg: "bg-green-100",  textCol: "text-green-600" },
  transferring: { text: "Transferring", bg: "bg-accent/10",  textCol: "text-accent" },
  done:         { text: "Completed",    bg: "bg-green-100",  textCol: "text-green-700" },
  error:        { text: "Failed",       bg: "bg-red-100",    textCol: "text-red-600" }
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.textCol} animate-in fade-in zoom-in duration-300`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${status === 'transferring' ? 'animate-pulse' : ''} bg-current`} />
      {config.text}
    </div>
  );
}
