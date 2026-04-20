# Technical Specification - PeerBridge

## 1. System Architecture
PeerBridge consists of three primary layers:
1. **Frontend (Client):** A React application built with Vite.
2. **Signaling Server:** A Node.js/Express server using Socket.io for peer coordination.
3. **P2P Transport:** WebRTC (Direct browser-to-browser).

### 1.1 Data Flow
1. **Room Creation:** Sender creates a room on the Signaling Server via `Socket.io`.
2. **Offer/Answer:** Receiver joins the room; both exchange SDP (Session Description Protocol) offers and answers through the Signaling Server.
3. **ICE Candidates:** Both peers exchange network details (IPs, Ports) via the Signaling Server.
4. **Direct Link:** Once a connection is established, the Signaling Server steps aside. Data flows directly via `RTCDataChannel`.

## 2. Technology Stack
### 2.1 Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + Framer Motion (for animations)
- **WebRTC API:** `RTCPeerConnection`, `RTCDataChannel`
- **Signaling Client:** `socket.io-client`
- **Persistence:** IndexedDB (for storing incoming files before final save)
- **Security:** Web Crypto API (for SHA-256 hashing)

### 2.2 Backend
- **Environment:** Node.js (v18+)
- **Web Framework:** Express.js
- **Signaling Engine:** Socket.io
- **Session Auth:** Firebase Admin SDK (Google Login integration)
- **Deployment:** Render / Vercel / Docker

## 3. Data Models
### 3.1 Signaling Room (Memory Store)
```javascript
{
  roomId: "uuid-v4-string",
  passwordHash: "sha256-hash-string",
  hostId: "socket-id-of-sender",
  meta: {
    fileCount: 3,
    totalSize: 50000000, // 50MB
    files: [
      { name: "file1.png", size: 100000, type: "image/png" },
      ...
    ]
  },
  peers: Set(), // set of socket IDs for receivers
  createdAt: 1713500000000
}
```

## 4. WebRTC Implementation Details
### 4.1 Chunking Strategy
To handle large files (>1GB) without crashing the browser:
- Files are read using `FileReader.readAsArrayBuffer()` in **256KB chunks**.
- The `RTCDataChannel.bufferedAmount` property is monitored. If it exceeds **2MB**, the transfer pauses until the buffer drains.

### 4.2 Protocol Commands (JSON over DataChannel)
- `{ "cmd": "meta-file", "name": "...", "size": 123 }`: Sent before file data starts.
- `{ "cmd": "file-done", "index": 0 }`: Sent after the final chunk of a file.
- `{ "cmd": "all-done" }`: Sent after all files and text have been transmitted.

## 5. Security Protocol
1. **Password Hashing:** User enters "secret123". The browser hashes it: `SHA256("secret123") -> "hash_abc"`.
2. **Verification:** The "hash_abc" is sent to the signaling server. The receiver must provide a password that hashes to the same "hash_abc".
3. **Encryption:** WebRTC uses DTLS (Datagram Transport Layer Security) by default for all DataChannel traffic, ensuring end-to-end encryption.

## 6. Development Workflow
### 6.1 Local Setup
1. **Frontend:** `npm install`, then `npm run dev`.
2. **Backend:** `npm install`, then `node server.js`.
3. **Env Vars:** `VITE_SIGNAL_URL` for the client to find the signaling server.

### 6.2 Key Directories
- `/src/lib/webrtc.js`: Core P2P logic (Sender/Receiver classes).
- `/src/lib/idb.js`: IndexedDB wrapper.
- `/src/components/UI/`: Tailwind-styled React components.
- `/server/server.js`: Node.js signaling and room logic.
