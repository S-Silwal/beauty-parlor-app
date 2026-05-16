// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest to handle TypeScript files
  preset: 'ts-jest',

  // Test environment (Node.js since it's a backend)
  testEnvironment: 'node',

  // Where to look for tests
  roots: ['<rootDir>/src', '<rootDir>/tests'],

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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Clear mocks and modules between tests
  clearMocks: true,
  resetMocks: true,

  // Verbose output (shows each test name)
  verbose: true,

  // Test timeout (increase if your tests are slow due to DB)
  testTimeout: 30000, // 30 seconds
};

export default config;