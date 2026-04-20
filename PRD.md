# Product Requirements Document (PRD) - PeerBridge

## 1. Introduction
PeerBridge is a P2P tool designed to replace traditional cloud-based file sharing with a more private, direct-to-peer approach. It aims to solve the problem of data retention, privacy leaks, and upload time by using WebRTC for real-time browser-to-browser transfers.

## 2. Target Audience
- **Security-conscious users:** People who don't want their files stored on corporate servers.
- **Freelancers/Developers:** Sharing code snippets or large design assets.
- **Office workers:** Sending documents across the room or across the globe without local server overhead.

## 3. User Stories
- **As a Sender**, I want to drag and drop files so I can share them instantly.
- **As a Sender**, I want to set a password for my transfer to ensure only the intended recipient can access it.
- **As a Receiver**, I want to enter a password to decrypt and receive the files directly in my browser.
- **As a User**, I want to see the real-time progress of my file transfer.
- **As a Receiver**, I want my files to persist in my browser even if I reload before downloading them (via IndexedDB).

## 4. Functional Requirements
### 4.1 Sender Interface
- **File Upload Area:** Supports drag-and-drop and manual file selection (up to 5 files at a time).
- **Text Area:** Allows sending text snippets alongside files.
- **Password Protection:** Mandatory password field for each shareable link.
- **Link Generation:** Creates a unique UUID link for the session.
- **Real-time Status:** Displays which peers are connected and the current progress of each file.
- **Session Control:** Warns the sender if they try to close the tab while a transfer is in progress.

### 4.2 Receiver Interface
- **Landing Page:** Simple password entry field.
- **Verification:** Only proceeds if the SHA-256 hash of the password matches the one stored on the signaling server.
- **P2P Transfer:** Automatically establishes a WebRTC connection once the password is verified.
- **Download Management:** List of received files with "Save" buttons and overall progress bars.

### 4.3 Signaling Server
- **Room Management:** Dynamically creates and deletes "rooms" based on peer presence.
- **Metadata Storage:** Stores temporary transfer metadata (file names, sizes, password hashes).
- **Relay (ICE/STUN):** Provides public STUN servers for peer discovery.

## 5. Non-Functional Requirements
- **Security:** Use SHA-256 for password hashing. Use cryptographically secure UUIDs for room IDs.
- **Performance:** Low-latency signaling (Socket.io). High-speed data channels (SCTP-based WebRTC).
- **Usability:** Mobile-first, responsive design. Intuitive progress indicators.
- **Scalability:** Horizontal scaling of Node.js signaling server (via Redis if needed).

## 6. UI/UX Design Goals
- **Minimalism:** Clean white/dark theme with bold typography.
- **Visual Feedback:** Smooth animations for file selection, connection establishment, and progress updates.
- **Interactive States:** Distinct visual cues for "Waiting for Peer", "Connected", and "Done".

## 7. Future Scope
- **Multiple Receivers:** One-to-many P2P broadcasting.
- **Group Chat:** Basic real-time text chat within the transfer session.
- **QR Code Sharing:** Scanning a QR code to open the link on mobile devices.
