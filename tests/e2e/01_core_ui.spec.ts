import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { pruneSnapshots } from "./helpers/snapshot_cleaner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("E2E Phase 1: Core Non-AI UI Components & Tools", () => {
  test.afterAll(async () => {
    const snapshotsDir = path.resolve(__dirname, "snapshots");
    pruneSnapshots(snapshotsDir, 3);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/?test=1");
    // Ensure Suspense loader has completed and real UI is mounted
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });
  });

  test("should display top navigation bar, sidebar controls and theme toggle", async ({ page }) => {
    // Verify main app layout shell is mounted
    const root = page.locator("#root");
    await expect(root).toBeVisible();

    // Verify sidebar workspaces
    await expect(page.getByText("Default Workspace").first()).toBeVisible();

    // Capture visual snapshot for Core Shell
    await page.screenshot({ path: path.join(__dirname, "snapshots", "core_ui_shell.png") });
  });

  test("should interact with Investigation log table and toolbars", async ({ page }) => {
    // Ensure Investigation page elements are visible
    const tableOrToolbar = page
      .locator("input[placeholder*='search'], input[type='text'], button:has-text('Tail')")
      .first();
    await expect(tableOrToolbar).toBeVisible({ timeout: 10000 });

    // Wait for log hydration to finish if present
    const hydratingText = page.locator("text=/Retrieving logs/i");
    if (await hydratingText.isVisible()) {
      await hydratingText.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    }
    await page.waitForTimeout(500);

    // Capture visual snapshot for Investigation toolbar and loaded logs
    await page.screenshot({ path: path.join(__dirname, "snapshots", "core_ui_investigation.png") });
  });

  test("should navigate to Dashboard and display metric widgets & charts", async ({ page }) => {
    const dashboardBtn = page.locator("button:has-text('Dashboard')").first();
    await expect(dashboardBtn).toBeVisible();
    await dashboardBtn.click();

    // Wait for Dashboard content to render
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });
    await expect(page.getByText(/Total Index|Records in context|Dashboard/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Capture visual snapshot for Dashboard widgets
    await page.screenshot({ path: path.join(__dirname, "snapshots", "core_ui_dashboard.png") });
  });
});
