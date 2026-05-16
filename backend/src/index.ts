// src/index.ts
import app from "./app";
import { prisma } from "./config/database";
import { serverConfig } from "./config/server";

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    app.listen(serverConfig.port, () => {
      console.log(`🚀 Server running on http://localhost:${serverConfig.port}`);
      console.log(`🔗 Health Check: http://localhost:${serverConfig.port}/health`);
    });
  } catch (error: any) {
    console.error("❌ Failed to start server:", error.message || error);
    process.exit(1);
  }
};

startServer();