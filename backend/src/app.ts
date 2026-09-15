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
import { checkAllIntegrations } from "./utils/externalHealthChecks";

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
import { requestContext } from "./middleware/requestContext.middleware";
import {
  apiRateLimiter,
  appointmentBookingLimiter,
} from "./middleware/ratelimitter.middleware";

dotenv.config();

const app = express();

// ====================== GLOBAL MIDDLEWARE ======================
// This is a pure JSON API — no HTML views, no inline scripts/styles to
// allow, no legitimate reason to ever be framed by another page. helmet()'s
// bare defaults are already reasonably strict, but they're written out
// explicitly and locked all the way down here rather than relying on
// undocumented defaults — see "worth a CSP... check its default directives
// are actually restrictive" in the 30-day hardening audit.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    frameguard: { action: "deny" },
  })
);

// Assigns req.requestId + X-Request-Id, and logs one structured line per
// completed request — needed to correlate a failed booking with whatever
// background notification attempt it triggered (see H6 in the audit).
app.use(requestContext);

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
// General limiter applies everywhere; auth/login/register/reset-password
// each carry their own specific limiter at the route level (see
// auth.routes.ts) — applying it a second time here would double-count
// every request against that limiter's budget.
app.use(apiRateLimiter);

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
// Used to only ping Postgres, so monitoring could report "all green" while
// email, SMS, image storage, or scheduled reminders were silently broken —
// see the 30-day hardening audit. `status`/HTTP code still reflect only the
// database (the thing that actually makes the app unusable if it's down);
// `integrations` surfaces the rest so a dashboard/alert can catch "core is
// up but Resend is down" without treating the whole service as unhealthy.
app.get("/health", async (req, res) => {
  const integrations = await checkAllIntegrations();

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: "OK",
      server: "Running ✅",
      database: "Connected ✅",
      environment: serverConfig.nodeEnv,
      integrations,
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      success: false,
      status: "Error",
      database: "NOT Connected ❌",
      integrations,
    });
  }
});

// Global Error Handler - MUST BE LAST
app.use(errorHandler);

export default app;
