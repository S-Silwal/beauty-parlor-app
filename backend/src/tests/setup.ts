// tests/setup.ts
import { prisma } from '../config/database';
import dotenv from 'dotenv';

// Load environment variables for tests (optional but recommended)
dotenv.config({ path: '.env.test' });

// ====================== GLOBAL SETUP ======================
beforeAll(async () => {
  console.log('🧪 Initializing test environment...');

  try {
    await prisma.$connect();
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
});

// ====================== GLOBAL CLEANUP ======================
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  try {
    await prisma.$disconnect();
    console.log('✅ Test database disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
});

// Optional: Reset database before each test (uncomment if you want fresh data every test)
// beforeEach(async () => {
//   await prisma.appointment.deleteMany({});
//   await prisma.refreshToken.deleteMany({});
//   await prisma.otpCode.deleteMany({});
//   await prisma.passwordResetToken.deleteMany({});
//   console.log('🗑️ Database reset for next test');
// });