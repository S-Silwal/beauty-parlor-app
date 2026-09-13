// src/config/database.ts
import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient({
  // Full query logging is useful in development but floods production logs
  // (and can leak query parameter values) — keep only errors/warnings there.
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty',
});

// Optional: Add graceful shutdown
process.on('beforeExit', async () => {
  await prismaClient.$disconnect();
});

export { prismaClient as prisma };
export default prismaClient;