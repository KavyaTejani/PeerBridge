import { createContext, useContext, useState, useCallback } from 'react';

const TransferContext = createContext(null);

export function TransferProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [transferStatus, setTransferStatus] = useState('idle');
  const [progress, setProgress] = useState({});

  const resetTransfer = useCallback(() => {
    setSocket(null);
    setTransferStatus('idle');
    setProgress({});
  }, []);

  return (
    <TransferContext.Provider value={{ socket, setSocket, transferStatus, setTransferStatus, progress, setProgress, resetTransfer }}>
      {children}
    </TransferContext.Provider>
  );
}

export const useTransfer = () => useContext(TransferContext);
