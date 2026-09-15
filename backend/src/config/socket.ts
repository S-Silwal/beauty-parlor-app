 // src/config/socket.ts
import dotenv from "dotenv";
dotenv.config();//

export const socketConfig = {
  cors: {
    // Mirrors config/server.ts's Express CORS origin — FRONTEND_URL is a
    // comma-separated list (staging + prod, or www + apex). Socket.io's
    // origin check is an exact string match, so passing the raw un-split
    // string here used to silently fail the handshake for every origin
    // except whichever happened to match the whole string.
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"] as string[],
    credentials: true,
  },
  // How long to wait before considering a client disconnected
  pingTimeout:  60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
} as const;

export type SocketConfigType = typeof socketConfig;