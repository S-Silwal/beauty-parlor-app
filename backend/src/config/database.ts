// src/config/database.ts
import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],   // Helpful during development
  errorFormat: 'pretty',
});

// Optional: Add graceful shutdown
process.on('beforeExit', async () => {
  await prismaClient.$disconnect();
});

export { prismaClient as prisma };
export default prismaClient;