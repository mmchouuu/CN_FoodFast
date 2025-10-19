import express from "express";
import { Server } from "socket.io";
import http from "http";
import dotenv from "dotenv";
import { connectRabbitMQ } from "./rabbitmq.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 4000;

function normaliseId(value) {
  if (!value) return null;
  if (Array.isArray(value)) return normaliseId(value[0]);
  const str = String(value).trim();
  return str.length ? str : null;
}

io.on("connection", (socket) => {
  console.log(`[socket-gateway] client connected: ${socket.id}`);

  const role = normaliseId(socket.handshake?.query?.role)?.toLowerCase();
  const ownerId = normaliseId(socket.handshake?.query?.ownerId);
  const restaurantId = normaliseId(socket.handshake?.query?.restaurantId);
  const customerId = normaliseId(socket.handshake?.query?.customerId);
  const autoRooms = new Set();

  if (role === "admin") {
    autoRooms.add("admin:restaurants");
  }
  if (role === "restaurant") {
    autoRooms.add("admin:restaurants");
    autoRooms.add("catalog:restaurants");
    if (ownerId) autoRooms.add(`restaurant-owner:${ownerId}`);
    if (restaurantId) autoRooms.add(`restaurant:${restaurantId}`);
  }
  if (role === "customer") {
    autoRooms.add("catalog:restaurants");
    if (customerId) autoRooms.add(`customer:${customerId}`);
  }

  autoRooms.forEach((room) => socket.join(room));
  if (autoRooms.size) {
    console.log(`[socket-gateway] auto joined rooms for ${socket.id}: ${Array.from(autoRooms).join(", ")}`);
  }

  socket.on("join-channel", (channel) => {
    if (!channel) return;
    const channels = Array.isArray(channel) ? channel : [channel];
    channels.forEach((room) => socket.join(room));
  });

  socket.on("leave-channel", (channel) => {
    if (!channel) return;
    const channels = Array.isArray(channel) ? channel : [channel];
    channels.forEach((room) => socket.leave(room));
  });

  socket.on("disconnect", () => {
    console.log(`[socket-gateway] client disconnected: ${socket.id}`);
  });
});

connectRabbitMQ(io);

app.get("/health", (_, res) => res.send("OK"));

server.listen(PORT, () => {
  console.log(`${process.env.APP_NAME || "SocketGateway"} is running on port ${PORT}`);
});
