import React, { useCallback } from 'react';
import { UploadIcon } from '../lib/icons';

export default function FileDropZone({ onFilesSelected, files }) {
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
    }
  }, [onFilesSelected]);

  const onFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="relative flex flex-col items-center justify-center w-full p-12 border-2 border-dashed rounded-3xl border-accent/20 bg-accent/[0.02] hover:bg-accent/[0.05] hover:border-accent/40 transition-all cursor-pointer group"
    >
      <input
        type="file"
        multiple
        onChange={onFileInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-5 bg-white rounded-[1.5rem] shadow-sm text-accent group-hover:scale-110 transition-transform duration-300">
          <UploadIcon className="w-10 h-10" />
        </div>
        <div>
          <p className="text-xl font-display text-gray-800 tracking-wide">
            {files.length > 0 ? `${files.length} FILES SELECTED` : "DROP FILES HERE OR CLICK"}
          </p>
          <p className="text-sm font-mono text-gray-400 mt-1 uppercase tracking-tighter">
            Unlimited Size • P2P Direct
          </p>
        </div>
      </div>
    </div>
  );
}
