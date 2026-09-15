// backend/.eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2021: true,
  },
  rules: {
    // Was fully 'off' — silently defeating one of TypeScript's main safety
    // nets. 'warn' (not 'error') is a deliberate choice: there are ~39
    // existing `any` usages across the codebase (mostly error-handler
    // `catch (err: any)` blocks and a couple of Cloudinary API response
    // shapes) that would need real type work to clean up properly, and
    // flipping straight to 'error' would break the build over pre-existing
    // code rather than just new code. 'warn' surfaces every one of them in
    // CI/lint output starting now, without blocking anything — the cleanup
    // itself is a separate, incremental task.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};