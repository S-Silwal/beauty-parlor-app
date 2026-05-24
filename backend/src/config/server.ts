// src/config/server.ts
import dotenv from "dotenv";

dotenv.config();

export const serverConfig = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",//tell entire app whether we're in development or production mode, which can be used to conditionally enable features like detailed logging or hot reloading

  // CORS Configuration
  corsOptions: {
    origin: process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())//multiple frontend url allowed
      : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,//allow cookies to be sent in cross-origin requests
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
};

// Optional: Export type for better TypeScript support
export type ServerConfigType = typeof serverConfig;