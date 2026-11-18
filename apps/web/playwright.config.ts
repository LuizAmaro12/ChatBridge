import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 10000 },
  reporter: [['list'], ['./tests/reporter.mjs']],
  use: { baseURL: 'http://localhost:3000', channel: 'msedge', headless: true,
    viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'npm run start', url: 'http://localhost:3000', reuseExistingServer: false,
    timeout: 60000, env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
