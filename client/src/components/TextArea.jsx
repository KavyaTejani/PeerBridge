import React from 'react';

export default function TextArea({ value, onChange, placeholder, disabled }) {
  return (
    <div className="w-full space-y-2 mt-4">
      <label className="text-sm font-medium text-gray-700">Message (Optional)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Add a note or snippets..."}
        disabled={disabled}
        rows={4}
        className="block w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-gray-800 disabled:opacity-50 resize-none font-mono text-sm"
      />
    </div>
  );
}
