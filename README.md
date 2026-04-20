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
       │<──────── peer introduction only ────────────> │
       │                                               │
       └─────────── WebRTC P2P Direct Transfer ────────┘
                    server never sees the file
```

## Security
- **SHA-256** password hashing in-browser.
- **UUID v4** unique room IDs.
- **WebRTC DTLS** encryption for the P2P data channel.

## Known Limitations
- Links are live only while the sender's tab is open.
- Connection requires STUN (and potentially TURN for strict NATs).
- Max 5 files per session (UI constraint).

---
*PeerBridge — Bridge the gap between devices, directly.*
