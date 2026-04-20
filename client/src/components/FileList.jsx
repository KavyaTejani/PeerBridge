import React from 'react';
import { FileIcon, DownloadIcon } from '../lib/icons';

export default function FileList({ files, progress, onDownload, showDownload }) {
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-2 mt-4">
      {files.map((file, idx) => (
        <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <FileIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {progress && progress[idx] !== undefined && (
              <div className="text-sm font-mono text-accent">{progress[idx]}%</div>
            )}
            
            {showDownload && (
              <button
                onClick={() => onDownload(idx)}
                className="p-2 hover:bg-accent/10 rounded-full text-accent transition-colors"
                title="Download"
              >
                <DownloadIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
