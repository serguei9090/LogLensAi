import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for LogLensAi.
 * Includes visual snapshot directory setup and snapshot retention rules.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  snapshotDir: "./tests/e2e/snapshots",
  timeout: 30000,
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  /* Local web server for tests automatically booted if port 4000 is down */
  webServer: {
    command: "bun run dev --port 4000",
    url: "http://localhost:4000",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
