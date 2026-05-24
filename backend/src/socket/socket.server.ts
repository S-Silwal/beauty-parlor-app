 // src/socket/socket.server.ts
import { Server as SocketIOServer } from "socket.io";
import { Server } from "http";
import { socketConfig } from "../config/socket";

let io: SocketIOServer;

export const initSocket = (httpServer: Server) => {
  io = new SocketIOServer(httpServer, {
    cors:         socketConfig.cors,         // ✅ was: hardcoded object with "*"
    pingTimeout:  socketConfig.pingTimeout,  // ✅ was: not set at all
    pingInterval: socketConfig.pingInterval, // ✅ was: not set at all
  });

  io.on("connection", (socket) => {
    console.log(`🟢 Client connected: ${socket.id}`);

    socket.on("joinAdmin", () => {
      socket.join("admin");
      console.log(`Admin joined: ${socket.id}`);
    });

    socket.on("joinCustomer", (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`Customer ${userId} joined their room`);
    });

    socket.on("disconnect", () => {
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });

  console.log("✅ Socket.io Server Initialized");
  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};