// src/app.ts
//
// Pure Express app: middleware + routes only. No http.Server, no Socket.io,
// no `listen()` — those are bootstrap concerns and live in server.ts. Keeping
// this file side-effect-free means it can be imported directly by tests
// (via supertest) without booting a real server or a real port.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import dotenv from "dotenv";

// Configs
import { prisma } from "./config/database";
import { serverConfig } from "./config/server";

// Routes
import authRoutes from "./routes/auth.routes";
import appointmentRoutes from "./routes/appointment.routes";
import serviceRoutes from "./routes/service.routes";
import staffRoutes from "./routes/staff.routes";
import userRoutes from "./routes/user.routes";
import galleryRoutes from "./routes/gallery.routes";
import notificationRoutes from "./routes/notification.routes";
import reviewRoutes from "./routes/review.routes";

// Middleware
import { errorHandler } from "./middleware/error.middleware";
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

// ====================== GLOBAL MIDDLEWARE ======================
app.use(helmet());

if (serverConfig.nodeEnv !== "test") {
  app.use(morgan(serverConfig.nodeEnv === "production" ? "combined" : "dev"));
}

app.use(
  cors({
    origin: serverConfig.corsOptions.origin,
    credentials: serverConfig.corsOptions.credentials,
    methods: serverConfig.corsOptions.methods,
    allowedHeaders: serverConfig.corsOptions.allowedHeaders,
  })
);

app.use(
  express.json({
    // Capture the exact raw bytes alongside the parsed body — needed to
    // verify webhook signatures (QStash) against what was actually signed.
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf.toString();
    },
  })
);
app.use(cookieParser());

// ====================== RATE LIMITING ======================
app.use(apiRateLimiter);

app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", createAccountLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", resetPasswordLimiter);
app.use("/api/appointments/book", appointmentBookingLimiter);

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reviews", reviewRoutes);

// ====================== HEALTH CHECK ======================
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: "OK",
      server: "Running ✅",
      database: "Connected ✅",
      environment: serverConfig.nodeEnv,
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      success: false,
      status: "Error",
      database: "NOT Connected ❌",
    });
  }
});

// Global Error Handler - MUST BE LAST
app.use(errorHandler);

export default app;
