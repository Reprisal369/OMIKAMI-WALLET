import { defineConfig } from 'vitest/config';

// Minimal, node-only test runner for apps/web. Scoped to *.test.ts so it only
// runs the security unit tests for the write-surface (apps/web/src/lib/tx/);
// component/e2e behaviour is covered by Playwright.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
