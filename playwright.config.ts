import { defineConfig, devices } from '@playwright/test';

/**
 * OMIKAMI WALLET — e2e configuration.
 * Runs the dev server and tests the read-only shell in desktop AND mobile
 * viewports. No real wallet and no real RPC are used: the wallet is a mocked
 * EIP-1193 provider and all JSON-RPC traffic is intercepted per test.
 * Note: the mobile project uses Pixel 7 (Chromium-based) deliberately —
 * iPhone descriptors require the WebKit engine, which is not installed.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm --filter @omikami/web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
