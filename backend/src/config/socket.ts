 // src/config/socket.ts
import dotenv from "dotenv";
dotenv.config();//

export const socketConfig = {
  cors: {
    // "*" in dev, real frontend URL in production
    origin:  process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"] as string[],
    credentials: true,
  },
  // How long to wait before considering a client disconnected
  pingTimeout:  60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
} as const;

export type SocketConfigType = typeof socketConfig;