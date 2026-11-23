import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // One persistent browser context with the extension per test file; keep it simple.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // One retry on CI: a failure that passes on retry is reported as "flaky", not hidden.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
});
