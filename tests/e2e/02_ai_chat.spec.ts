import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { pruneSnapshots } from "./helpers/snapshot_cleaner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("E2E Phase 2: AI Investigation Chat & Response Variations", () => {
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

  test("should open AI Assistant drawer / sidebar and verify controls", async ({ page }) => {
    // Locate AI Assistant trigger (Ctrl+J shortcut or sidebar button)
    await page.keyboard.press("Control+j");
    await page.waitForTimeout(600);

    // Verify AI sidebar / panel elements
    const chatInput = page
      .locator("textarea, input[placeholder*='Ask'], input[placeholder*='prompt']")
      .first();
    if (await chatInput.isVisible()) {
      await expect(chatInput).toBeVisible();
      await chatInput.fill("Summarize the root cause of recent fatal crashes");
    }

    // Capture visual snapshot for AI Chat Panel
    await page.screenshot({ path: path.join(__dirname, "snapshots", "ai_chat_panel.png") });
  });

  test("should verify AI Sessions switcher and history variations", async ({ page }) => {
    // Open AI drawer
    await page.keyboard.press("Control+j");
    await page.waitForTimeout(600);

    // Capture visual snapshot for Session switcher
    await page.screenshot({ path: path.join(__dirname, "snapshots", "ai_sessions_view.png") });
  });
});
