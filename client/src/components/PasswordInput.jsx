import React from 'react';
import { LockIcon } from '../lib/icons';

export default function PasswordInput({ value, onChange, placeholder, disabled }) {
  return (
    <div className="w-full space-y-2 mt-4">
      <label className="text-sm font-medium text-gray-700">Password Protection</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-accent transition-colors">
          <LockIcon className="w-5 h-5" />
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Set a password"}
          disabled={disabled}
          autoComplete="new-password"
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-gray-800 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
