// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Configs
import { prisma } from "./config/database";
import { serverConfig } from "./config/server";

// Routes
// Routes
import authRoutes from "./routes/auth.routes";
import appointmentRoutes from "./routes/appointment.routes";
import serviceRoutes from "./routes/service.routes";
import staffRoutes from "./routes/staff.routes";
import userRoutes from "./routes/user.routes";
import galleryRoutes from "./routes/gallery.routes"; // ✅ ADD THIS
// Middleware
import { errorHandler } from "./middleware/error.middleware";
import notificationRoutes from './routes/notification.routes';

dotenv.config();

const app = express();

// ====================== GLOBAL MIDDLEWARE ======================
app.use(
  cors({
    origin: serverConfig.corsOptions.origin,
    credentials: serverConfig.corsOptions.credentials,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
app.use(cookieParser());

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gallery", galleryRoutes); 
app.use("/api/notifications", notificationRoutes); 

// ✅ ADD THIS
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
      database: "NOT Connected ❌" 
    });
  }
});

// Global Error Handler - MUST BE LAST
app.use(errorHandler);

export default app;