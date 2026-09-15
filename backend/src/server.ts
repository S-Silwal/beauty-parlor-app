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
import { logger } from "./utils/logger";

// ====================== CRASH VISIBILITY ======================
// Before this, an unhandled rejection anywhere (a background notification
// send, an async webhook handler with no .catch) either crashed the process
// with a raw Node stack trace and no correlation, or — depending on Node
// version/flags — was silently swallowed entirely. Neither shows up in
// `logger.error`'s structured output or gets forwarded to Sentry (see
// utils/logger.ts). These two handlers are the minimum needed so "the
// process died" or "something threw in the background" is never a silent,
// undiagnosable event — this is what the audit's "no error tracking" gap
// actually meant in practice, not just missing a vendor dashboard.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception — process state may be corrupted, exiting", {
    error: error.message,
    stack: error.stack,
  });
  // Node's own docs recommend exiting after an uncaughtException rather than
  // resuming — the process may be in an inconsistent state. Give the log
  // line above a moment to flush, then exit; a process manager (pm2, Docker
  // restart policy, etc.) is expected to bring it back up.
  setTimeout(() => process.exit(1), 100);
});

const httpServer = http.createServer(app);

// ====================== INITIALIZE SOCKET.IO ======================
const io = initSocket(httpServer);

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

// ====================== GRACEFUL SHUTDOWN ======================
// Without this, a deploy or process manager restart (docker stop, a
// platform's rolling deploy, etc.) kills in-flight HTTP requests and the
// Prisma connection pool abruptly instead of draining them — the exact
// failure mode B1/B5 warned about ("this will bite the first time a real
// deploy happens mid-booking"). SIGTERM is what `docker stop` and most
// platform schedulers send; SIGINT is Ctrl+C in a local dev shell.
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return; // a second signal shouldn't restart the sequence
  shuttingDown = true;
  console.log(`\n🛑 ${signal} received — starting graceful shutdown...`);

  // Force-exit if draining takes too long, so a stuck connection can't hang
  // the process forever during a deploy.
  const forceExitTimer = setTimeout(() => {
    console.error("⏱️  Graceful shutdown timed out after 10s — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    // Stop accepting new socket connections and close existing ones — must
    // happen before httpServer.close(), since Socket.io sits on top of it.
    await new Promise<void>((resolve) => io.close(() => resolve()));
    console.log("✅ Socket.io connections closed");

    // Stops accepting new HTTP connections and waits for in-flight requests
    // to finish, rather than cutting them off mid-response.
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    console.log("✅ HTTP server closed — no more in-flight requests");

    await prisma.$disconnect();
    console.log("✅ Database connection pool closed");

    clearTimeout(forceExitTimer);
    console.log("👋 Graceful shutdown complete");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error during graceful shutdown:", error.message || error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
