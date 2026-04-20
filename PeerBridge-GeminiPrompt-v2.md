# PeerBridge — Master Build Prompt for Gemini CLI
> **Root Directory:** `\\wsl.localhost\Ubuntu\home\kavya\TestGemini\PeerBridge`  
> **Purpose:** Use this as the master reference prompt. Feed sections to Gemini CLI one phase at a time.

---

## PROJECT OVERVIEW

You are building **PeerBridge** (also branded as **LinkDrop** in the README) — a browser-to-browser P2P file and text sharing tool that uses **WebRTC** for direct peer connections. The signaling server only introduces peers; it never stores or sees file data.

**Core promise:** Zero server storage. Files travel directly between two browsers. Password-protected. Reload-safe.

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + Vite |
| Styling | Tailwind CSS + Framer Motion |
| Fonts | IBM Plex Mono + Bebas Neue (via Google Fonts) |
| P2P Transport | Native WebRTC (`RTCPeerConnection`, `RTCDataChannel`) |
| Signaling | Node.js + Express + Socket.io |
| Client Storage | Browser IndexedDB |
| Security | Web Crypto API (SHA-256 hashing in-browser) |
| Auth & Database | Firebase Auth + Firestore (mandatory) |
| Global State | React Context API (`AuthContext`, `TransferContext`) |

---

## FULL DIRECTORY STRUCTURE TO CREATE

```
PeerBridge/
├── client/
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── lib/
│   │   │   ├── peer.js           # Core WebRTC send/receive logic
│   │   │   ├── idb.js            # IndexedDB wrapper
│   │   │   ├── crypto.js         # SHA-256 hashing utility
│   │   │   ├── firebase.js       # Firebase init & exports
│   │   │   └── icons.jsx         # SVG icon components
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # Auth state (user, login, logout)
│   │   │   └── TransferContext.jsx # Global socket/transfer state
│   │   ├── hooks/
│   │   │   ├── useAuth.js        # Convenience hook for AuthContext
│   │   │   └── useTransfer.js    # Convenience hook for TransferContext
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx     # Login / Signup
│   │   │   ├── DashboardPage.jsx # Transfer history (protected)
│   │   │   ├── SharePage.jsx     # Sender interface (protected)
│   │   │   ├── ReceivePage.jsx   # Receiver interface
│   │   │   └── NotFoundPage.jsx  # 404 / invalid link
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── FileDropZone.jsx
│   │   │   ├── FileList.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── PasswordInput.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── TextArea.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── server/
│   ├── server.js                 # Signaling server (Socket.io + Express)
│   └── package.json
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## PHASE 1 — PROJECT SCAFFOLDING

### 1.1 Initialize the Monorepo Root

```bash
cd /home/kavya/TestGemini/PeerBridge
```

- Create a root `.gitignore` with entries for: `node_modules/`, `.env`, `dist/`, `.DS_Store`
- Do NOT create a root `package.json` — client and server are separate packages

### 1.2 Scaffold the Client (Vite + React)

Run in terminal:
```bash
cd /home/kavya/TestGemini/PeerBridge
npm create vite@latest client -- --template react
cd client
npm install
```

Then install all required client dependencies:
```bash
npm install socket.io-client framer-motion react-router-dom firebase
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 1.3 Scaffold the Server (Node.js)

```bash
cd /home/kavya/TestGemini/PeerBridge
mkdir server && cd server
npm init -y
npm install express socket.io cors uuid
```

### 1.4 Configure Tailwind CSS

In `client/tailwind.config.js`, set content paths:
```js
content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
```

In `client/src/index.css`, add Tailwind directives at the top:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 1.5 Configure Vite

In `client/vite.config.js`:
- Set server port to `5173`
- Add a proxy so `/socket.io` requests during development proxy to `http://localhost:3001`
```js
server: {
  proxy: {
    '/socket.io': {
      target: 'http://localhost:3001',
      ws: true
    }
  }
}
```

### 1.6 Add Google Fonts to index.html

In `client/index.html`, add inside `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### 1.7 Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a new project named `peerbridge`.
2. Enable **Authentication** → Sign-in method → enable **Google** provider.
3. Enable **Firestore Database** → start in production mode → choose a region.
4. Register a web app, copy the config object.
5. Create `client/src/lib/firebase.js`:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // paste your config here
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
```

6. Add Firebase config values to `client/.env`:
```env
VITE_SIGNAL_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
```

Update `firebase.js` to read from `import.meta.env.VITE_FIREBASE_*` instead of hardcoding values.

---

## PHASE 2 — SERVER (SIGNALING SERVER)

### 2.1 Build `server/server.js`

Create a complete Express + Socket.io signaling server with the following logic:

**In-memory room store:**
```js
const rooms = new Map();
// Each room: { roomId, passwordHash, hostId, meta: { files:[], totalSize }, peers: Set() }
```

**Express setup:**
- `GET /` → health check returning `{ status: "PeerBridge Signaling Server Running" }`
- `GET /room/:roomId` → returns room metadata (file names, sizes, file count, totalSize) and `exists: true/false`. Used by receiver to validate the link.
- CORS enabled for all origins in development.

**Socket.io events to handle (server-side):**

| Event (received) | Action |
|---|---|
| `create-room` | Accept `{ roomId, passwordHash, meta }`. Store room with `hostId = socket.id`. Emit `room-created` back. |
| `join-room` | Accept `{ roomId, passwordHash }`. Verify hash matches. If yes → add socket to room, emit `peer-joined` to host, emit `room-joined` to receiver with meta. If no → emit `auth-error`. |
| `offer` | Relay SDP offer `{ offer, roomId }` to the other peer in the room. |
| `answer` | Relay SDP answer `{ answer, roomId }` to the host. |
| `ice-candidate` | Relay ICE candidate `{ candidate, roomId }` to the other peer. |
| `disconnect` | Remove socket from all rooms. If host disconnects → emit `host-left` to all peers in that room, delete the room. If receiver disconnects → emit `peer-left` to the host. |

**STUN configuration to relay to peers:**
```js
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];
```
Emit `ice-servers` event to peers when they join, sending this list.

**Server listens on port `3001`.**

---

## PHASE 2.5 — AUTH & CONTEXT LAYER

### 2.5.1 Build `client/src/context/AuthContext.jsx`

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 2.5.2 Build `client/src/context/TransferContext.jsx`

Global state for the active transfer session (socket instance, status, progress). This prevents prop-drilling socket and status state through multiple components.

```jsx
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
```

### 2.5.3 Build `client/src/hooks/useAuth.js` and `useTransfer.js`

Re-export the context hooks for cleaner imports in pages:

```js
// useAuth.js
export { useAuth } from '../context/AuthContext';

// useTransfer.js
export { useTransfer } from '../context/TransferContext';
```

### 2.5.4 Build `client/src/components/ProtectedRoute.jsx`

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <div className="loading-screen">Loading...</div>; // auth initializing
  if (user === null) return <Navigate to="/login" replace />;
  return children;
}
```

### 2.5.5 Build `client/src/pages/LoginPage.jsx`

A clean, centered login page. Route: `/login`.

- Show the PeerBridge logo/name
- "Sign in with Google" button → calls `loginWithGoogle()` from AuthContext
- On successful auth, redirect to `/` (SharePage)
- If user is already logged in, redirect immediately to `/`

```jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user]);

  return (
    // Centered layout: app name, tagline, Google sign-in button
  );
}
```

### 2.5.6 Build `client/src/pages/DashboardPage.jsx`

Route: `/dashboard` (protected).

**Purpose:** Shows the logged-in user's transfer history — a CRUD surface backed by Firestore. This satisfies the rubric's requirement for persistent user data and CRUD operations.

**Firestore collection:** `transfers` — documents keyed by auto-ID.
Each document:
```js
{
  uid: "firebase-user-uid",
  roomId: "uuid",
  direction: "sent" | "received",
  files: [{ name, size }],
  fileCount: 3,
  totalSize: 50000000,
  createdAt: Timestamp,
  status: "completed" | "interrupted"
}
```

**CRUD operations to implement:**

- **Create:** When a sender's transfer completes (`status === 'done'`), call `logTransfer()`:
  ```js
  import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  export async function logTransfer(uid, data) {
    await addDoc(collection(db, 'transfers'), { uid, ...data, createdAt: serverTimestamp() });
  }
  ```
  Also call `logTransfer()` on the receiver side when `onAllDone()` fires (with `direction: 'received'`).

- **Read:** Dashboard fetches all transfers for the current user:
  ```js
  import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
  const q = query(collection(db, 'transfers'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
  ```

- **Delete:** Each history row has a "Delete" button → `deleteDoc(doc(db, 'transfers', docId))`.

- **Update:** (Optional but recommended for rubric) Add a "rename/note" field on each transfer entry — user can add a personal note via `updateDoc`.

**Dashboard UI:**
- Header with user avatar, display name, and "Sign Out" button
- Stats row: total transfers, total data sent
- Transfer history table/list:
  - Icon for direction (↑ sent / ↓ received)
  - File names (comma-separated), file count, total size
  - Date/time (formatted)
  - Status badge
  - Delete button
- Empty state: "No transfers yet. Start sharing!" with a link to `/`

---

## PHASE 3 — CLIENT LIBRARIES

### 3.1 Build `client/src/lib/crypto.js`

Implement a single async function:
```js
export async function hashPassword(password) {
  // Use window.crypto.subtle.digest('SHA-256', ...)
  // Convert ArrayBuffer to hex string
  // Return hex string
}
```

### 3.2 Build `client/src/lib/idb.js`

IndexedDB wrapper for persisting received files between page reloads. The DB name should be `"peerbridge-db"`, object store name `"files"`.

Implement and export these async functions:
- `saveFile(sessionId, fileIndex, { name, type, arrayBuffer })` → stores file blob in IDB under key `${sessionId}-${fileIndex}`
- `getFile(sessionId, fileIndex)` → retrieves the stored file object
- `getAllFiles(sessionId)` → retrieves all files for a session
- `clearSession(sessionId)` → deletes all IDB entries for that session
- `initDB()` → opens/creates the DB (call once on app start)

### 3.3 Build `client/src/lib/peer.js`

This is the most critical file. Create two classes: `SenderPeer` and `ReceiverPeer`.

**`SenderPeer` class:**

Constructor accepts: `{ socket, roomId, iceServers, onStatusChange, onProgress }`

Methods:
- `async createOffer()` → creates RTCPeerConnection, sets up data channel named `"fileTransfer"` with `{ ordered: true }`, creates SDP offer, sets local description, emits `offer` via socket.
- `async handleAnswer(answer)` → sets remote description from receiver's SDP answer.
- `async addIceCandidate(candidate)` → adds ICE candidate.
- `async sendFiles(files, textContent)` → main transfer logic:
  1. Emit `meta-all` command: `{ cmd: "meta-all", fileCount: files.length, hasText: !!textContent }`
  2. For each file:
     a. Emit `{ cmd: "meta-file", name, size, type, index }` as JSON string.
     b. Read file as ArrayBuffer using `FileReader`.
     c. Slice into **256KB chunks** (`256 * 1024` bytes).
     d. For each chunk: check `dataChannel.bufferedAmount`. If > `2 * 1024 * 1024` (2MB), wait using a polling loop with `await sleep(50)`.
     e. Send chunk as ArrayBuffer.
     f. Update `onProgress(index, sentBytes, totalBytes)`.
     g. After all chunks: send `{ cmd: "file-done", index }` as JSON string.
  3. If textContent: send `{ cmd: "text", content: textContent }`.
  4. Send `{ cmd: "all-done" }`.
- `destroy()` → closes data channel and peer connection.

**`ReceiverPeer` class:**

Constructor accepts: `{ socket, roomId, iceServers, sessionId, onStatusChange, onFileReceived, onProgress, onTextReceived, onAllDone }`

Methods:
- `async handleOffer(offer)` → creates RTCPeerConnection, sets remote description from offer, creates SDP answer, sets local description, emits `answer` via socket. Sets up `ondatachannel` listener.
- `async addIceCandidate(candidate)` → adds ICE candidate.
- `setupDataChannel(channel)` → internal method:
  - Maintains state: `currentFileIndex`, `currentFileMeta`, `receivedChunks`, `receivedBytes`
  - `channel.onmessage`: detect if message is JSON string (starts with `{`) or ArrayBuffer.
    - JSON: parse and handle `cmd` values: `meta-all`, `meta-file`, `file-done`, `text`, `all-done`.
    - ArrayBuffer: push to `receivedChunks`, update progress via `onProgress`.
  - On `file-done`: concatenate all chunks into a single ArrayBuffer, call `onFileReceived(index, { name, type, data: arrayBuffer })`, also save to IDB via `saveFile(sessionId, index, ...)`, reset chunk state.
  - On `all-done`: call `onAllDone()`.
- `destroy()` → closes peer connection.

**Helper inside peer.js:**
```js
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
```

### 3.4 Build `client/src/lib/icons.jsx`

Create SVG icon components as named exports:
- `<UploadIcon />` — cloud/arrow up icon
- `<FileIcon />` — generic file icon
- `<LockIcon />` — padlock icon
- `<LinkIcon />` — chain link icon
- `<CheckIcon />` — checkmark icon
- `<SpinnerIcon />` — animated loading spinner
- `<CopyIcon />` — copy/clipboard icon
- `<DownloadIcon />` — download arrow icon
- `<WarningIcon />` — triangle warning icon

All icons should be simple, clean SVGs sized `1em` by default with `currentColor` fill/stroke.

---

## PHASE 4 — UI COMPONENTS

### 4.1 Global Design System

Define CSS variables in `client/src/index.css`:
```css
:root {
  --bg: #0a0a0a;
  --surface: #111111;
  --border: #222222;
  --accent: #ffffff;
  --accent-muted: #888888;
  --success: #4ade80;
  --error: #f87171;
  --font-display: 'Bebas Neue', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
```

Body styles: dark background (`--bg`), text white, font family `--font-mono`, min-height 100vh.

### 4.2 `FileDropZone.jsx`

Props: `{ onFilesSelected, disabled }`

- A drag-and-drop zone (div with `onDragOver`, `onDrop`, `onClick` handlers)
- Internally holds a hidden `<input type="file" multiple accept="*/*" />` ref for click-to-select
- Max 5 files — show error message if user drops more than 5
- Visual states:
  - **Default:** dashed border, subtle background, upload icon + "Drag & drop files here" label
  - **Drag-over:** brighter border, slightly scaled up (Framer Motion `whileHover` or CSS)
  - **Disabled:** reduced opacity, pointer-events none
- On file selection, call `onFilesSelected(filesArray)`

### 4.3 `FileList.jsx`

Props: `{ files, progress }` where `progress` is `{ [index]: { sent, total } }`

- Renders a list of selected files with:
  - File name (truncated if too long with CSS `text-overflow: ellipsis`)
  - File size formatted (e.g., "4.2 MB")
  - A `<ProgressBar />` for each file during transfer
- Use Framer Motion `AnimatePresence` + `motion.div` for list item enter/exit animations

### 4.4 `ProgressBar.jsx`

Props: `{ percent, label, color }`

- A thin (4px height) horizontal progress bar
- Smooth CSS `transition` on width
- Show percentage text label beside it
- Colors: default white fill on dark track; success state turns green

### 4.5 `PasswordInput.jsx`

Props: `{ value, onChange, placeholder, disabled }`

- A styled `<input type="password" />` with:
  - Mono font
  - Dark background, white border on focus
  - Show/hide password toggle button (eye icon) on the right
  - Framer Motion subtle scale on focus

### 4.6 `StatusBadge.jsx`

Props: `{ status }` where status is one of: `"waiting"` | `"connecting"` | `"connected"` | `"done"` | `"error"`

- A small pill/badge component
- Color mapping:
  - `waiting` → grey with pulsing animation
  - `connecting` → yellow/amber
  - `connected` → green
  - `done` → green with checkmark
  - `error` → red

### 4.7 `TextArea.jsx`

Props: `{ value, onChange, placeholder, disabled }`

- A styled `<textarea />` for sending text snippets
- Mono font, dark theme, auto-resize (using `onInput` to adjust height)
- Character count indicator in bottom-right

---

## PHASE 5 — PAGES

### 5.1 `SharePage.jsx` (Sender Interface)

**Route:** `/` (home page)

**State variables to manage:**
```js
const [files, setFiles] = useState([]);
const [text, setText] = useState('');
const [password, setPassword] = useState('');
const [roomId] = useState(() => crypto.randomUUID());
const [shareLink, setShareLink] = useState('');
const [status, setStatus] = useState('idle'); 
// idle | creating | waiting | connected | transferring | done | error
const [progress, setProgress] = useState({});
const [peerConnected, setPeerConnected] = useState(false);
const [copied, setCopied] = useState(false);
const [socket, setSocket] = useState(null);
const [senderPeer, setSenderPeer] = useState(null);
```

**UI Sections (top to bottom):**

1. **Header:** "PEERBRIDGE" in Bebas Neue, large. Tagline: "Bridge the gap between devices, directly." in small mono text.

2. **File Drop Zone:** `<FileDropZone onFilesSelected={setFiles} disabled={status !== 'idle'} />`

3. **Selected Files List:** Show `<FileList files={files} progress={progress} />` if files.length > 0.

4. **Text Area:** `<TextArea value={text} onChange={e => setText(e.target.value)} placeholder="Optional: paste a code snippet or note..." />`

5. **Password Field:** `<PasswordInput value={password} onChange={...} placeholder="Set a transfer password" />` with helper text: "Required. The receiver must enter this password."

6. **Create Link Button:**
   - Disabled if: no files AND no text, or password is empty, or status !== 'idle'
   - Label: "Create Link"
   - On click → call `handleCreateLink()`

7. **Share Link Panel** (shown after link is created, animated in with Framer Motion):
   - Display the full link in a mono code block
   - Copy button with clipboard icon → copies link, shows "Copied!" for 2 seconds
   - Status badge showing current connection status
   - Message: "Waiting for receiver to join..."
   - Progress section appears once transfer starts

**`handleCreateLink()` logic:**
1. Hash the password using `hashPassword(password)` from `crypto.js`.
2. Connect socket to signaling server: `io(import.meta.env.VITE_SIGNAL_URL || 'http://localhost:3001')`.
3. Emit `create-room` with `{ roomId, passwordHash, meta: { files: files.map(f => ({ name: f.name, size: f.size, type: f.type })), totalSize, fileCount: files.length } }`.
4. On `room-created`: set `shareLink` to `${window.location.origin}/receive/${roomId}`, set status to `waiting`.
5. On `peer-joined`: set status to `connecting`, create `SenderPeer`, call `createOffer()`.
6. On `answer`: call `senderPeer.handleAnswer(answer)`.
7. On `ice-candidate`: call `senderPeer.addIceCandidate(candidate)`.
8. When SenderPeer's `onStatusChange` fires `"connected"`: set `peerConnected = true`, set status to `connected`, immediately call `senderPeer.sendFiles(files, text)`.
9. On `onProgress(index, sent, total)`: update `progress` state.
10. On `all-done` from SenderPeer: set status to `done`. Also call `logTransfer(user.uid, { direction: 'sent', roomId, files: files.map(f => ({ name: f.name, size: f.size })), fileCount: files.length, totalSize, status: 'completed' })` from the Firestore helper (Phase 2.5.6). Import `useAuth` and get `user` from it.

**`beforeunload` protection:**
- Add a `window.addEventListener('beforeunload', handler)` when status is `transferring` or `connected`.
- Remove it when status is `done` or `idle`.
- The handler sets `event.returnValue = "Transfer in progress. Are you sure you want to leave?"`

### 5.2 `ReceivePage.jsx` (Receiver Interface)

**Route:** `/receive/:roomId`

**State variables:**
```js
const { roomId } = useParams();
const [sessionId] = useState(() => roomId); 
const [step, setStep] = useState('loading'); 
// loading | enter-password | connecting | receiving | done | error | not-found
const [password, setPassword] = useState('');
const [meta, setMeta] = useState(null); // { files, totalSize, fileCount }
const [receivedFiles, setReceivedFiles] = useState([]);
const [progress, setProgress] = useState({});
const [text, setText] = useState('');
const [errorMsg, setErrorMsg] = useState('');
const [socket, setSocket] = useState(null);
const [receiverPeer, setReceiverPeer] = useState(null);
```

**Step-based UI:**

**Step: `loading`**
- Spinner + "Verifying link..." text
- On mount: `GET /room/:roomId` from signaling server
- If `exists: false` → set step to `not-found`
- If `exists: true` → store `meta`, set step to `enter-password`

**Step: `enter-password`**
- Show room metadata: "X files ready to receive" or file names list
- `<PasswordInput>` for entering the password
- "Connect & Receive" button — note: this authenticates access to the session; it does NOT decrypt the files. WebRTC DTLS handles transport-layer encryption transparently. The password only gates who is allowed to initiate the P2P connection.
- On submit → call `handleJoin()`

**`handleJoin()` logic:**
1. Hash the entered password using `hashPassword(password)`.
2. Connect socket.
3. Emit `join-room` with `{ roomId, passwordHash }`.
4. On `auth-error` → show error "Incorrect password", reset to `enter-password`.
5. On `room-joined` → set step to `connecting`, create `ReceiverPeer` instance.
6. On `offer` → call `receiverPeer.handleOffer(offer)`, then socket emits the answer.
7. On `ice-candidate` → `receiverPeer.addIceCandidate(candidate)`.
8. On `host-left` → if step is not `done`, show error "Sender disconnected before transfer completed."

**ReceiverPeer callbacks:**
- `onStatusChange("connected")` → set step to `receiving`
- `onFileReceived(index, { name, type, data })` → append to `receivedFiles`
- `onProgress(index, received, total)` → update `progress` state
- `onTextReceived(content)` → set `text`
- `onAllDone()` → set step to `done`

**Step: `receiving`**
- Overall progress bar (sum of all files)
- Per-file progress bars from `<FileList>`
- Animated status: "Receiving files directly from sender's browser..."

**Step: `done`**
- List of all received files with:
  - File name, size
  - "Save" / "Download" button per file (creates object URL and triggers download)
- If text was received: show it in a code block with a "Copy" button
- "All done! Files are saved in your browser." message
- Note: "Files will persist until you clear browser storage"

**On IDB restore (page reload handling):**
- On mount (in `done` step or on reload): call `getAllFiles(sessionId)` from IDB
- If files exist in IDB → pre-populate `receivedFiles` and jump to `done` step

### 5.3 `NotFoundPage.jsx`

- Simple centered page: "404" in huge Bebas Neue
- "This link is invalid or has expired." message
- "Start a new transfer" link back to `/`

---

## PHASE 6 — APP ROUTING

### 6.1 `App.jsx`

Wrap the app in both context providers. Add routes for `/login` and `/dashboard`.

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TransferProvider } from './context/TransferContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SharePage from './pages/SharePage';
import ReceivePage from './pages/ReceivePage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <TransferProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><SharePage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/receive/:roomId" element={<ReceivePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </TransferProvider>
    </AuthProvider>
  );
}
```

Note: `ReceivePage` is intentionally NOT wrapped in `ProtectedRoute` — a receiver shouldn't need an account to receive files.

### 6.2 `main.jsx`

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initDB } from './lib/idb';

initDB().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode><App /></React.StrictMode>
  );
});
```

---

## PHASE 7 — ENVIRONMENT & CONFIGURATION

### 7.1 Create `client/.env`

```env
VITE_SIGNAL_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
```

> ⚠️ Add `client/.env` to `.gitignore`. Never commit real Firebase keys.

### 7.2 Create `client/.env.production`

```env
VITE_SIGNAL_URL=https://your-deployed-server.com
```

### 7.3 Update `client/package.json` scripts

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

### 7.4 Update `server/package.json` scripts

```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js"
}
```

---

## PHASE 8 — ANIMATIONS & POLISH

Apply Framer Motion animations throughout:

| Element | Animation |
|---|---|
| Share link panel appearing | `initial: { opacity: 0, y: 20 }` → `animate: { opacity: 1, y: 0 }` |
| File list items | `AnimatePresence` with `initial: { opacity: 0, x: -10 }` on mount |
| Status badge | `animate` on background-color change |
| "Done" screen | Staggered children reveal with `staggerChildren: 0.1` |
| Connection pulse indicator | CSS `@keyframes pulse` animation on the waiting badge |
| Drop zone hover | `whileHover: { scale: 1.01 }` |
| Buttons | `whileTap: { scale: 0.97 }` |

**CSS animations to add in `index.css`:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## PHASE 9 — ERROR HANDLING & EDGE CASES

Implement these scenarios explicitly:

1. **Sender closes tab mid-transfer:**
   - `beforeunload` warning fires (Phase 5.1)
   - Server `disconnect` event removes room and emits `host-left` to receiver

2. **Wrong password on receiver side:**
   - Server emits `auth-error`
   - UI shows "Incorrect password. Try again." and resets the password field

3. **ICE connection failure (NAT/firewall):**
   - `RTCPeerConnection.oniceconnectionstatechange` — if state becomes `"failed"` or `"disconnected"`, emit error via `onStatusChange("error")`
   - UI shows: "Connection failed. This may be due to strict network/firewall settings."
   - Add a TURN server note in the README for this case

4. **File too large for memory:**
   - The 256KB chunking + buffer backpressure system (implemented in `peer.js`) handles this
   - Additionally in `FileDropZone`: warn (but don't block) if total size > 1GB with a yellow advisory

5. **More than 5 files dropped:**
   - `FileDropZone` filters to first 5 files and shows: "Only 5 files can be sent at once. First 5 selected."

6. **Room link opened when sender is offline:**
   - `/room/:roomId` returns `{ exists: false }`
   - Receiver sees `NotFoundPage` immediately

7. **Receiver reloads mid-transfer:**
   - Files already fully received are in IDB — those show up
   - Files not yet received are lost (show partial info)
   - Note this limitation to user on the receive page

---

## PHASE 9.5 — README (SUBMISSION REQUIREMENT)

Write a comprehensive `README.md` at the project root. It must include all sections required for submission:

```markdown
# PeerBridge

> Bridge the gap between devices, directly.

## Problem Statement
[Explain: who is the user, what problem this solves, why it matters]
- Security-conscious users who don't want files stored on corporate servers
- Freelancers sharing large assets without cloud upload delays
- Anyone needing instant, private, direct browser-to-browser file transfer

## Features
- Zero server storage — files never touch the server
- Password-protected sessions (SHA-256 hashed, never transmitted as plaintext)
- Reload-safe — received files persist in IndexedDB
- Transfer history dashboard per user (Firebase)
- Up to 5 files + text snippet per session
- Real-time progress with per-file progress bars
- Works on mobile and desktop

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS + Framer Motion |
| P2P | WebRTC (RTCDataChannel) |
| Signaling | Node.js + Express + Socket.io |
| Auth & DB | Firebase Auth (Google) + Firestore |
| Storage | Browser IndexedDB |

## Setup Instructions
### Prerequisites
- Node.js v18+
- A Firebase project (see firebase.js for config)

### 1. Clone the repo
git clone <repo-url>
cd PeerBridge

### 2. Configure Firebase
Create client/.env with your Firebase credentials (see .env.example)

### 3. Start the signaling server
cd server && npm install && npm run dev

### 4. Start the client
cd client && npm install && npm run dev

Open http://localhost:5173

## Architecture
[Include the ASCII architecture diagram from the original README]

## Known Limitations
- Links are live only while the sender's tab is open
- No TURN server configured — connections on very strict NATs may fail
- Max 5 files per session
```

---

## PHASE 10 — FINAL TESTING CHECKLIST

Test these flows manually in browser after building:

- [ ] **Auth flow:** Visit `/` when logged out — verify redirect to `/login`. Sign in with Google — verify redirect back to `/`.
- [ ] **Protected routes:** Try accessing `/dashboard` while logged out — verify redirect to `/login`.
- [ ] **Transfer history (Create):** Complete a sender transfer — verify a new document appears in Firestore `transfers` collection with `direction: 'sent'`.
- [ ] **Transfer history (Read):** Open `/dashboard` — verify completed transfers are listed with correct file names, sizes, and timestamps.
- [ ] **Transfer history (Delete):** Click delete on a history row — verify it disappears from UI and Firestore.
- [ ] **Basic P2P transfer:** Open `/` in Tab A, create link with 1 file + password. Open link in Tab B, enter password, verify file transfers and downloads correctly.
- [ ] **Multiple files (up to 5):** Verify all 5 files transfer and each has its own progress bar.
- [ ] **Text snippet:** Send text alongside files, verify it appears on receiver side.
- [ ] **Wrong password:** Enter wrong password on receiver — verify `auth-error` is shown.
- [ ] **Large file (>100MB):** Verify chunking works, progress updates smoothly, no browser crash.
- [ ] **IDB persistence:** Receive a file, reload receiver tab, verify files still appear and can be downloaded.
- [ ] **Tab close warning:** Start a transfer, try to close sender tab, verify browser warning fires.
- [ ] **Invalid link:** Open `/receive/fake-id` — verify 404 page shows.
- [ ] **Host disconnect:** Close sender tab mid-transfer — verify receiver sees "Sender disconnected" error.
- [ ] **Mobile responsiveness:** Test both pages on mobile viewport (375px width).
- [ ] **Cross-browser:** Test in Chrome + Firefox (Safari if available).

---

## HOW TO RUN LOCALLY

```bash
# Terminal 1 — Start signaling server
cd /home/kavya/TestGemini/PeerBridge/server
npm install
npm run dev

# Terminal 2 — Start React client
cd /home/kavya/TestGemini/PeerBridge/client
npm install
npm run dev
```

Open `http://localhost:5173` in two tabs.

---

## GEMINI CLI USAGE GUIDE

Feed phases to Gemini CLI in this order, one at a time:

```
1.  "Set up the project structure for PeerBridge as described in Phase 1, including Firebase setup in Phase 1.7."
2.  "Build the signaling server as described in Phase 2."
3.  "Build the Auth & Context layer as described in Phase 2.5 — AuthContext, TransferContext, hooks, ProtectedRoute, LoginPage, and DashboardPage."
4.  "Build all library files: crypto.js, idb.js, peer.js, icons.jsx as in Phase 3."
5.  "Build all UI components as described in Phase 4."
6.  "Build SharePage.jsx as described in Phase 5.1."
7.  "Build ReceivePage.jsx as described in Phase 5.2."
8.  "Build App.jsx routing and main.jsx as described in Phase 6 — include both context providers and ProtectedRoute wrappers."
9.  "Set up all environment files and package.json scripts as in Phase 7."
10. "Apply all Framer Motion animations as described in Phase 8."
11. "Implement all error handling edge cases as in Phase 9."
12. "Write the README.md as described in Phase 9.5."
```

After each phase, verify the code compiles and the feature works before moving on.

---

*PeerBridge — Bridge the gap between devices, directly.*
