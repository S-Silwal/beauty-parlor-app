 // src/server.ts
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Configs
import { prisma } from "./config/database";
import { serverConfig } from "./config/server";

// Socket.io
import { initSocket } from "./socket/socket.server";

// Routes
import authRoutes from "./routes/auth.routes";
import appointmentRoutes from "./routes/appointment.routes";
import serviceRoutes from "./routes/service.routes";
import staffRoutes from "./routes/staff.routes";
import userRoutes from "./routes/user.routes";
import galleryRoutes from "./routes/gallery.routes";

// Middleware
import { errorHandler } from "./middleware/error.middleware";

// ✅ Rate Limiters
import {
  apiRateLimiter,
  authRateLimiter,
  createAccountLimiter,
  appointmentBookingLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "./middleware/ratelimitter.middleware";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// ====================== INITIALIZE SOCKET.IO ======================
initSocket(httpServer);

// ====================== GLOBAL MIDDLEWARE ======================
app.use(
  cors({
    origin: serverConfig.corsOptions.origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
app.use(cookieParser());

// ====================== RATE LIMITING ======================

// General rate limit for all APIs
app.use(apiRateLimiter);

// Stricter limits for sensitive routes
app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", createAccountLimiter);

app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", resetPasswordLimiter);

// Booking protection
app.use("/api/appointments/book", appointmentBookingLimiter);

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gallery", galleryRoutes);

// ====================== HEALTH CHECK ======================
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: "OK",
      server: "Running ✅",
      database: "Connected ✅",
      socket: "Initialized ✅",
      environment: serverConfig.nodeEnv,
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ 
      success: false, 
      status: "Error", 
      database: "NOT Connected ❌" 
    });
  }
});

// ====================== GLOBAL ERROR HANDLER (MUST BE LAST) ======================
app.use(errorHandler);

// ====================== START SERVER ======================
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    const PORT = serverConfig.port || 5000;

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`📡 Socket.io ready for real-time updates`);
      console.log(`🛡️  Rate limiting is active`);
    });

  } catch (error: any) {
    console.error("❌ Failed to start server:", error.message || error);
    process.exit(1);
  }
};

startServer();

export default app;