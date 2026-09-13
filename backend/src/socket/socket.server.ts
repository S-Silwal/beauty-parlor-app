 // src/socket/socket.server.ts
import { Server as SocketIOServer } from "socket.io";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { socketConfig } from "../config/socket";
import { authConfig } from "../config/auth";

let io: SocketIOServer;

interface SocketUser {
  userId: string;
  role: string;
}

export const initSocket = (httpServer: Server) => {
  io = new SocketIOServer(httpServer, {
    cors:         socketConfig.cors,         // ✅ was: hardcoded object with "*"
    pingTimeout:  socketConfig.pingTimeout,  // ✅ was: not set at all
    pingInterval: socketConfig.pingInterval, // ✅ was: not set at all
  });

  // Verify the JWT (if any) on the handshake and attach the identity it
  // proves. Room membership is derived from THIS, never from anything the
  // client asks for — a socket can only ever be placed in its own
  // "user_<id>" room and the "admin" room only if its verified role earns it.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      // No token — allow the connection, but it won't be joined to any
      // room, so it receives no private booking/admin data.
      return next();
    }

    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as SocketUser;
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser | undefined;
    console.log(
      `🟢 Client connected: ${socket.id}${user ? ` (user ${user.userId})` : ""}`
    );

    if (user) {
      // Every authenticated socket joins its own room — never one chosen
      // by the client — so a customer can only ever receive their own
      // booking updates.
      socket.join(`user_${user.userId}`);

      // Only a verified ADMIN/STAFF token earns a seat in the admin
      // broadcast room, which carries every customer's booking details.
      if (user.role === "ADMIN" || user.role === "STAFF") {
        socket.join("admin");
      }
    }

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