const DB_NAME = "peerbridge-db";
const STORE_NAME = "files";

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFile(sessionId, fileIndex, { name, type, arrayBuffer }) {
  const db = await initDB();
  const key = `${sessionId}-${fileIndex}`;
  const data = { name, type, arrayBuffer, savedAt: Date.now() };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getFile(sessionId, fileIndex) {
  const db = await initDB();
  const key = `${sessionId}-${fileIndex}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFiles(sessionId) {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    const keysRequest = store.getAllKeys();
    
    request.onsuccess = () => {
      const allFiles = request.result;
      const allKeys = keysRequest.result;
      // Filter by session ID prefix
      const filtered = allFiles.filter((_, i) => allKeys[i].toString().startsWith(sessionId));
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearSession(sessionId) {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const keysRequest = store.getAllKeys();
    
    keysRequest.onsuccess = () => {
      const keys = keysRequest.result;
      const sessionKeys = keys.filter(k => k.toString().startsWith(sessionId));
      sessionKeys.forEach(k => store.delete(k));
      resolve();
    };
    keysRequest.onerror = () => reject(keysRequest.error);
  });
}
