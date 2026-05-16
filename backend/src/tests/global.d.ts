// tests/global.d.ts
/// <reference types="jest" />

// This makes Jest globals available across all test files
declare global {
  const describe: typeof import('@jest/globals').describe;
  const test: typeof import('@jest/globals').test;
  const it: typeof import('@jest/globals').it;
  const expect: typeof import('@jest/globals').expect;
  const beforeAll: typeof import('@jest/globals').beforeAll;
  const afterAll: typeof import('@jest/globals').afterAll;
  const beforeEach: typeof import('@jest/globals').beforeEach;
  const afterEach: typeof import('@jest/globals').afterEach;
}

// This is required so TypeScript treats this as a module
export {};