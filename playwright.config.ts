import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-electron',
      testMatch: /.*electron\.e2e\.ts/,
    },
    {
      name: 'web-chromium',
      testMatch: /.*web\.e2e\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
