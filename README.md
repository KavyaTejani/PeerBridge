<div align="center">

<br />
<h1 font-family="monospace"> PEERBRIDGE</h1>

### Decentralized Browser-to-Browser File & Text Sharing

<br />


![Stack](https://img.shields.io/badge/React%2019%20%2B%20Tailwind%20v4%20%2B%20WebRTC-white?style=flat-square&labelColor=black)
![P2P](https://img.shields.io/badge/P2P%20Direct%20Transfer-white?style=flat-square&labelColor=black)
![Storage](https://img.shields.io/badge/Zero%20Server%20Storage-white?style=flat-square&labelColor=black)

<br />

</div>

---

## Overview

**PeerBridge** is a decentralized, high-performance utility for direct file and text sharing. Built on the core principle of total privacy, it uses **WebRTC** to establish a direct link between two browsers. Your files travel directly from point A to point B — the signaling server only introduces the peers and never sees, stores, or touches your data.

---

## How It Works

```text
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
