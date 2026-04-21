const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const rooms = new Map();

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" }
];

// ICE servers are resolved at startup (and refreshed periodically for short-lived
// TURN credentials). Three configuration paths, in priority order:
//
//   1. METERED_APP_NAME + METERED_API_KEY   — fetch per-request credentials from
//      https://dashboard.metered.ca/ (recommended; free tier is enough for dev/demo)
//   2. TURN_URL + TURN_USERNAME + TURN_CREDENTIAL — a self-hosted coturn or any
//      static TURN server. TURN_URL may be a comma-separated list.
//   3. Neither — STUN-only, which works on home networks but fails on most
//      corporate/symmetric-NAT setups.
//
// The old `openrelay.metered.ca` public credentials were removed — that service
// is no longer reachable on the relay ports (443/3478), which is why transfers
// fail on restrictive networks.
let ICE_SERVERS = [...STUN_SERVERS];

async function refreshIceServers() {
  const meteredApp = process.env.METERED_APP_NAME;
  const meteredKey = process.env.METERED_API_KEY;

  if (meteredApp && meteredKey) {
    try {
      const res = await fetch(
        `https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const turnServers = await res.json();
      ICE_SERVERS = [...STUN_SERVERS, ...turnServers];
      console.log(`[ICE] Loaded ${turnServers.length} TURN server(s) from Metered`);
      return;
    } catch (e) {
      console.error("[ICE] Metered credential fetch failed:", e.message);
    }
  }

  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    const urls = process.env.TURN_URL.split(",").map(s => s.trim()).filter(Boolean);
    ICE_SERVERS = [
      ...STUN_SERVERS,
      {
        urls,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      }
    ];
    console.log(`[ICE] Using manual TURN server(s): ${urls.join(", ")}`);
    return;
  }

  ICE_SERVERS = [...STUN_SERVERS];
  console.warn("[ICE] No TURN server configured — P2P will fail on restrictive NATs. Set METERED_APP_NAME+METERED_API_KEY or TURN_URL/TURN_USERNAME/TURN_CREDENTIAL.");
}

refreshIceServers();
// Metered credentials are short-lived; refresh hourly.
setInterval(refreshIceServers, 60 * 60 * 1000);

app.get("/", (req, res) => {
  res.json({ status: "PeerBridge Signaling Server Running" });
});

app.get("/room/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (room) {
    res.json({ exists: true, meta: room.meta });
  } else {
    res.json({ exists: false });
  }
});

io.on("connection", (socket) => {
  socket.on("create-room", ({ roomId, passwordHash, meta }, cb) => {
    rooms.set(roomId, {
      roomId,
      passwordHash,
      hostId: socket.id,
      meta,
      peers: new Set()
    });
    socket.join(roomId);
    socket.roomId = roomId;
    if (cb) cb({ status: "ok", iceServers: ICE_SERVERS });
  });

  socket.on("join-room", ({ roomId, passwordHash }, cb) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (cb) cb({ error: "Room not found" });
      return;
    }

    if (room.passwordHash !== passwordHash) {
      socket.emit("auth-error");
      if (cb) cb({ error: "Invalid password" });
      return;
    }

    room.peers.add(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    
    io.to(room.hostId).emit("peer-joined", { peerId: socket.id });
    socket.emit("ice-servers", ICE_SERVERS);
    
    if (cb) cb({ status: "ok", meta: room.meta, iceServers: ICE_SERVERS });
  });

  socket.on("offer", ({ offer, roomId, to }) => {
    const target = to || rooms.get(roomId)?.hostId;
    if (target) {
      io.to(target).emit("offer", { offer, from: socket.id });
    }
  });

  socket.on("answer", ({ answer, roomId, to }) => {
    const target = to || rooms.get(roomId)?.hostId;
    if (target) {
      io.to(target).emit("answer", { answer, from: socket.id });
    }
  });

  socket.on("ice-candidate", ({ candidate, roomId, to }) => {
    const target = to || rooms.get(roomId)?.hostId;
    if (target) {
      io.to(target).emit("ice-candidate", { candidate, from: socket.id });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        if (room.hostId === socket.id) {
          io.to(roomId).emit("host-left");
          rooms.delete(roomId);
        } else {
          room.peers.delete(socket.id);
          io.to(room.hostId).emit("peer-left", { peerId: socket.id });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
