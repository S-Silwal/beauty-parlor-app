// src/server.ts
//
// Bootstrap only: wraps the Express app (src/app.ts) in an http.Server,
// initializes Socket.io on it, connects to the database, and starts
// listening. This is the file `npm run dev`/`npm start` actually run.
import http from "http";
import dotenv from "dotenv";

dotenv.config();

import { validateEnv } from "./config/validateEnv";
validateEnv();

import app from "./app";
import { prisma } from "./config/database";
import { serverConfig } from "./config/server";
import { initSocket } from "./socket/socket.server";

const httpServer = http.createServer(app);

// ====================== INITIALIZE SOCKET.IO ======================
initSocket(httpServer);

// ====================== START SERVER ======================
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    httpServer.listen(serverConfig.port, () => {
      console.log(`🚀 Server running on http://localhost:${serverConfig.port}`);
      console.log(`🔗 Health Check: http://localhost:${serverConfig.port}/health`);
      console.log(`📡 Socket.io ready for real-time updates`);
      console.log(`🛡️  Rate limiting is active`);
    });
  } catch (error: any) {
    console.error("❌ Failed to start server:", error.message || error);
    process.exit(1);
  }
};

startServer();
