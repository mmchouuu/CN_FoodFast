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

io.on("connection", (socket) => {
  console.log(`[socket-gateway] client connected: ${socket.id}`);

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
