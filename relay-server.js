const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const port = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocketServer({ server });
const rooms = new Map();

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function roomPeers(roomId) {
  const room = rooms.get(roomId) || new Set();
  return [...room]
    .map((client) => client.meta)
    .filter(Boolean)
    .map(({ role, deviceId, keepAwake }) => ({ role, deviceId, keepAwake }));
}

function broadcastPresence(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const message = {
    type: "presence",
    payload: {
      roomId,
      peers: roomPeers(roomId),
    },
  };

  room.forEach((client) => send(client, message));
}

function leaveRoom(socket) {
  const roomId = socket.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(socket);
  if (room.size === 0) {
    rooms.delete(roomId);
  } else {
    broadcastPresence(roomId);
  }
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(socket, {
        type: "error",
        payload: { message: "Invalid JSON" },
      });
      return;
    }

    if (message.type === "join") {
      const roomId = String(message.payload?.roomId || "").trim().toUpperCase();
      const role = message.payload?.role;

      if (!roomId || !role) {
        send(socket, {
          type: "error",
          payload: { message: "roomId and role are required" },
        });
        return;
      }

      leaveRoom(socket);
      socket.roomId = roomId;
      socket.meta = {
        role,
        deviceId: message.payload.deviceId || "unknown-device",
        keepAwake: Boolean(message.payload.keepAwake),
      };

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(socket);

      send(socket, {
        type: "joined",
        payload: {
          roomId,
          role,
        },
      });
      broadcastPresence(roomId);
      return;
    }

    const roomId = socket.roomId;
    if (!roomId || !rooms.has(roomId)) {
      send(socket, {
        type: "error",
        payload: { message: "Join a room before sending messages" },
      });
      return;
    }

    if (
      message.type === "command" ||
      message.type === "status" ||
      message.type === "notification" ||
      message.type === "call" ||
      message.type === "message_thread" ||
      message.type === "photo_library" ||
      message.type === "capabilities"
    ) {
      rooms.get(roomId).forEach((client) => {
        if (client !== socket) {
          send(client, message);
        }
      });
      return;
    }

    send(socket, {
      type: "error",
      payload: { message: `Unsupported message type ${message.type}` },
    });
  });

  socket.on("close", () => {
    leaveRoom(socket);
  });
});

server.listen(port, () => {
  console.log(`RemoPhone relay listening on ws://0.0.0.0:${port}`);
});
