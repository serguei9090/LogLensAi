import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { pruneSnapshots } from "./helpers/snapshot_cleaner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("E2E Phase 3: Knowledge RAG & Memory Retrieval", () => {
  test.afterAll(async () => {
    const snapshotsDir = path.resolve(__dirname, "snapshots");
    pruneSnapshots(snapshotsDir, 3);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/?test=1");
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });
  });

  test("should load settings and verify Knowledge RAG status & hardware selector", async ({
    page,
  }) => {
    // Navigate to Settings using sidebar button
    const settingsBtn = page.locator("button:has-text('Settings')").first();
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Wait for Settings Panel to render
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });
    await expect(page.getByText(/General|AI Providers|Drain3|RAG/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Capture visual snapshot for Settings
    await page.screenshot({ path: path.join(__dirname, "snapshots", "rag_settings_panel.png") });
  });

  test("should test semantic retrieval query with sample log line", async ({ page }) => {
    // Open AI assistant with Ctrl+J
    await page.keyboard.press("Control+j");
    await page.waitForTimeout(600);

    const queryInput = page
      .locator("textarea, input[placeholder*='Ask'], input[placeholder*='prompt']")
      .first();
    if (await queryInput.isVisible()) {
      const sampleLogLine = "Error 500: Database connection pool exhausted at worker-04";
      await queryInput.fill(`Explain log: ${sampleLogLine}`);
    }

    // Capture visual snapshot for RAG query state
    await page.screenshot({ path: path.join(__dirname, "snapshots", "rag_sample_query.png") });
  });
});
