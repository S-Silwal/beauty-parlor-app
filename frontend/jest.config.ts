import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Must match tsconfig.json's "@/*": ["./src/*"] path alias.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts(x)'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
};

export default config;