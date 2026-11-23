import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // One persistent browser context with the extension per test file; keep it simple.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? 'github' : 'list',
});
