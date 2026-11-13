// jest.config.ts
import type { Config } from 'jest';

// Run every test in the SALON's timezone. Many tests build times with
// Date#setHours(), which uses the machine's local zone — so "10:00" meant
// 10 AM on a dev laptop in Indianapolis but 5-6 AM salon time in UTC CI.
// Now that booking enforces salon hours, that difference would make CI
// reject bookings the same tests accept locally. Pinning TZ here (the
// config loads before any worker starts) makes setHours() mean salon time
// everywhere. Production code never relies on TZ: it uses utils/timezone.
process.env.TZ = 'America/Indiana/Indianapolis';

const config: Config = {
  // Use ts-jest to handle TypeScript files
  preset: 'ts-jest',

  // Test environment (Node.js since it's a backend)
  testEnvironment: 'node',

  // Where to look for tests — all tests live under src/tests, there is no
  // separate top-level tests/ directory.
  roots: ['<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],

  // File extensions Jest should recognize
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],

  // Module path mapping (for clean @/ imports)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/',
    '/coverage/',
  ],

  // Setup file that runs before all tests
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],

  // Clear mocks and modules between tests
  clearMocks: true,
  resetMocks: true,

  // Verbose output (shows each test name)
  verbose: true,

  // Test timeout (increase if your tests are slow due to DB)
  testTimeout: 30000, // 30 seconds
};

export default config;