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

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { 
    urls: "turn:openrelay.metered.ca:80", 
    username: "openrelayproject", 
    credential: "openrelayproject" 
  },
  { 
    urls: "turn:openrelay.metered.ca:443", 
    username: "openrelayproject", 
    credential: "openrelayproject" 
  },
  { 
    urls: "turn:openrelay.metered.ca:443?transport=tcp", 
    username: "openrelayproject", 
    credential: "openrelayproject" 
  },
  { 
    urls: "turns:openrelay.metered.ca:443?transport=tcp", 
    username: "openrelayproject", 
    credential: "openrelayproject" 
  }
];

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
