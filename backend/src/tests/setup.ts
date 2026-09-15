// tests/setup.ts
import { prisma } from '../config/database';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Tests never send real email. getResend() still requires a truthy
// RESEND_API_KEY before it will even construct a client, so give it one —
// and mock the actual Resend package so nothing hits the network.
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test_dummy_key';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

beforeEach(() => {
  // jest.config.ts has resetMocks:true, which wipes the mockResolvedValue
  // above before every single test — re-apply it here so every test still
  // gets a working mocked send(), not one that silently resolves undefined.
  (Resend as unknown as jest.Mock).mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  }));
});

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