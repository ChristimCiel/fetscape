import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/pages',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: process.env.CI ? 120000 : 30000,
  expect: { timeout: process.env.CI ? 15000 : 5000 },
  reporter: 'list',
  use: {
    baseURL: process.env.PAGES_TEST_URL || 'http://127.0.0.1:4189/fetscape/',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1512, height: 1100 },
    launchOptions: {
      args: process.env.CI ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    },
    trace: 'retain-on-failure',
  },
  webServer: process.env.PAGES_TEST_URL
    ? undefined
    : {
        command: 'npm run preview:pages',
        url: 'http://127.0.0.1:4189/fetscape/',
        reuseExistingServer: false,
        timeout: 30000,
      },
});
