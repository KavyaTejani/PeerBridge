# PeerBridge

> Bridge the gap between devices, directly.

## Problem Statement
Traditional file sharing often relies on cloud storage, which means your sensitive data is stored on corporate servers, even if only temporarily. **PeerBridge** eliminates this by using **WebRTC** to create a direct, peer-to-peer link between two browsers. Files travel directly from the sender's device to the receiver's device — the server never sees, stores, or touches your data.

## Features
- **Zero Server Storage:** Files never touch the server disk. Pure P2P transfer.
- **Any File Type:** No restrictions on extensions.
- **Unlimited File Size:** Only limited by browser memory and network.
- **Password Protected:** Every transfer requires a password to initiate the connection.
- **Reload-Safe:** Received files persist in **IndexedDB** until you choose to download them.
- **Dashboard:** Track your transfer history (sent/received) with a Firebase-backed dashboard.
- **Privacy First:** Passwords are hashed in-browser (SHA-256) and never sent in plaintext.

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
- A Firebase project (for Auth and Firestore)

### 1. Configure Environment
Create a `client/.env` file with your Firebase credentials:
```env
VITE_SIGNAL_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 2. Install & Start Signaling Server
```bash
cd server
npm install
npm run dev
```

### 3. Install & Start Client
```bash
cd client
npm install
npm run dev
```

## Architecture
```
Sender's Browser                              Receiver's Browser
       │                                               │
       │         Signaling Server (Socket.io)          │
       │◄──────── peer introduction only ────────────► │
       │                                               │
       └─────────── WebRTC P2P Direct Transfer ────────┘
                    (Data never touches the server)
```

1. **Upload:** Sender drops files, sets a secure password, and creates a bridge.
2. **Link:** A unique, cryptographically secure link is generated.
3. **Connect:** Receiver enters the password to initiate the P2P handshake.
4. **Transfer:** Data streams directly between browsers using encrypted data channels.

---

## Features

- **Zero Server Storage:** Files are never uploaded to a cloud. Pure browser-to-browser sync.
- **Unlimited File Size:** Restricted only by your device's memory and network bandwidth.
- **Any File Type:** Seamlessly share `.exe`, `.zip`, `.mp4`, `.pdf`, or raw text snippets.
- **Real-Time Dashboard:** Track your inbound and outbound "nodes" (transfers) via a Firebase-backed history ledger.
- **Reload-Safe:** Uses **IndexedDB** to persist received data, allowing downloads to survive page refreshes.
- **Privacy-First Security:** SHA-256 password hashing performed client-side; plaintext never leaves your machine.
- **Cyber-Minimalist UI:** High-contrast dark-mode interface built with Space Grotesk and JetBrains Mono.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite |
| **Styling** | Tailwind CSS v4 + Framer Motion |
| **Fonts** | Space Grotesk + JetBrains Mono |
| **P2P Transport** | WebRTC (`RTCPeerConnection` + `RTCDataChannel`) |
| **Signaling** | Node.js + Express + Socket.io |
| **Auth & DB** | Firebase Auth (Google) + Firestore (History) |
| **Local Storage** | Browser IndexedDB |

---

## Project Structure

```text
PeerBridge/
├── client/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── peer.js          # WebRTC P2P orchestration
│   │   │   ├── idb.js           # IndexedDB persistence layer
│   │   │   └── firebase.js      # Auth & Firestore configuration
│   │   ├── pages/
│   │   │   ├── SharePage.jsx    # Sender node interface
│   │   │   ├── ReceivePage.jsx  # Receiver node interface
│   │   │   └── DashboardPage.jsx# Real-time transfer ledger
│   │   └── index.css            # Global Tailwind v4 styles
├── server/
│   └── server.js                # Socket.io signaling server
└── README.md
```

---

## Security

- **End-to-End Encryption:** All data channels are secured via WebRTC DTLS.
- **One-Way Hashing:** Passwords are salted and hashed with SHA-256 before signaling.
- **Unguessable Links:** Session IDs are generated using UUID v4.
- **Ephemeral Node States:** Links remain active only while the sender's bridge remains open.

---

<div align="center">
  <sub>Built with WebRTC · Zero Server Storage · P2P Direct · Password Protected</sub>
</div>
