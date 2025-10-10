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
    origin: "*", // bạn có thể chỉ định cụ thể URL FE ở đây
  },
});

const PORT = process.env.PORT || 4000;

// Khi client kết nối
io.on("connection", (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// Cho RabbitMQ gửi message qua socket
connectRabbitMQ(io);

app.get("/health", (_, res) => res.send("OK"));

server.listen(PORT, () => {
  console.log(`🚀 ${process.env.APP_NAME} is running on port ${PORT}`);
});
