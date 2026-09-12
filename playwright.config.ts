import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    // Some environments ship a prepared Chromium instead of Playwright's own
    // download. Point at it when PLAYWRIGHT_CHROMIUM_PATH is set.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // Always start a fresh server: a server left over from an earlier build
    // serves chunk names that no longer exist, which looks like an app crash.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      GJM_DB_DRIVER: 'local-file',
      GJM_LOCAL_MODE: '1',
      GJM_LOCAL_PASSWORD: 'local-test',
      GJM_LOCAL_DB_DIR: process.env.GJM_LOCAL_DB_DIR ?? '.gjm-data',
      NODE_ENV: 'production',
    },
  },
});
