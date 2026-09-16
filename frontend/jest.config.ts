import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Must match tsconfig.json's "@/*": ["./src/*"] path alias.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Note the `?` before `(x)` — this is Jest's actual documented default
  // ("optional x"), matching both .test.ts and .test.tsx. A previous
  // version of this file had `.ts(x)` (no `?`), which glob-parses as a
  // literal group rather than "optional x" — so it matched .ts(x) as a
  // literal filename ending and therefore matched nothing real. That bug
  // sat dormant since there were no test files to trigger it until now.
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  // Next.js's .next build output contains its own package.json (also named
  // "frontend"), which Jest's project-wide file crawl was picking up and
  // colliding with the real one on module name — this keeps Jest out of
  // build artifacts entirely rather than just tolerating the warning.
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  // tsconfig.json targets "module": "esnext" / "moduleResolution": "bundler"
  // for Next.js's own webpack bundler — neither is something ts-jest
  // running under plain Node can execute directly. This overrides just
  // what ts-jest compiles test files with, without touching the actual
  // tsconfig.json Next.js itself builds from.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        jsx: 'react-jsx',
      },
    }],
  },
};

export default config;
