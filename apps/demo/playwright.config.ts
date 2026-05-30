import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the S20 styled layer. Drives the real rendered screens in Chromium,
 * using a CDP virtual authenticator for the WebAuthn ceremonies. Requires the
 * workspace to be built first (`pnpm -r build`) — the dev server imports the
 * packages' `dist`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite --port 4321 --strictPort',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
