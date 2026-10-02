import { defineConfig, devices } from '@playwright/test'

const PORT = 8788

export default defineConfig({
  testDir: './e2e/tests',
  // Every test signs up its own people, so tests do not depend on each other's data.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // The Chrome that is already installed (also on GitHub's runners), so no browser is downloaded.
    channel: 'chrome',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'phone',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: './e2e/start-server.sh',
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
})
