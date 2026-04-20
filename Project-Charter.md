# Project Charter - PeerBridge

## 1. Project Overview
**Project Name:** PeerBridge  
**Vision:** To provide a seamless, secure, and zero-storage platform for direct browser-to-browser file and text sharing using WebRTC.  
**Tagline:** Bridge the gap between devices, directly.

## 2. Project Goals
- **Privacy First:** Eliminate the need for server-side storage of user data.
- **Ease of Use:** A "one-click" experience for generating shareable links.
- **High Performance:** Support large file transfers restricted only by the user's browser and network capabilities.
- **Modern UI/UX:** A sleek, minimal, and responsive interface built with Vite + React.

## 3. Success Criteria
- **Zero Data Retention:** 100% of files must be transferred via P2P without touching server disk space.
- **Speed:** Latency-free signaling for establishing WebRTC connections.
- **Security:** Every transfer must be encrypted via DTLS (built into WebRTC) and protected by user-defined passwords hashed with SHA-256.
- **Cross-Platform:** Full functionality across Chrome, Firefox, Safari, and Edge on both Desktop and Mobile.

## 4. Key Stakeholders
- **Users:** Individuals needing to send sensitive files quickly without using cloud storage.
- **Developers:** Senior Frontend and Backend engineers building and maintaining the WebRTC/Signaling layers.
- **System Admins:** Responsible for the Node.js signaling server and monitoring performance.

## 5. High-Level Requirements
- **Frontend:** React 18, Vite, Tailwind CSS (for modern UI), Socket.io-client.
- **Backend:** Node.js, Express, Socket.io (Signaling), Firebase (Auth/Metadata).
- **Core Logic:** WebRTC `RTCPeerConnection`, `RTCDataChannel`, IndexedDB for local persistence.

## 6. Constraints & Risks
- **Network Restrictions:** Symmetric NATs/Firewalls may block direct P2P connections (requires STUN/TURN fallback).
- **Browser Limits:** Large file transfers (>2GB) may hit browser memory limits if not handled with proper chunking/buffering.
- **Ephemeral Links:** Links are only active while the sender is online; closing the tab terminates the transfer.

## 7. Timeline (Estimated)
- **Phase 1: Research & Spec:** 1 Week
- **Phase 2: Core Logic (WebRTC/Signaling):** 2 Weeks
- **Phase 3: UI/UX Development:** 2 Weeks
- **Phase 4: Testing & Optimization:** 1 Week
