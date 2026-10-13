import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { pruneSnapshots } from "./helpers/snapshot_cleaner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("Full Exhaustive E2E Option & Control Verification", () => {
  test.afterAll(async () => {
    const snapshotsDir = path.resolve(__dirname, "snapshots");
    pruneSnapshots(snapshotsDir, 3);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/?test=1");
    // Ensure Suspense loader has completed
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });
  });

  test("1. Dashboard: should exercise all controls, dropdowns, modes, and filters", async ({
    page,
  }) => {
    // 1.1 Navigate to Dashboard
    const dashboardNavBtn = page.locator("button:has-text('Dashboard')").first();
    await expect(dashboardNavBtn).toBeVisible();
    await dashboardNavBtn.click();
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });

    // 1.2 Verify Top Stat Cards
    await expect(page.getByText("TOTAL INDEX").first()).toBeVisible();
    await expect(page.getByText("PATTERNS").first()).toBeVisible();
    await expect(page.getByText("LIVE STREAMS").first()).toBeVisible();
    await expect(page.getByText("CATALOGS").first()).toBeVisible();

    // 1.3 Toggle Mode: Switch to AI Insights mode
    const aiInsightsModeBtn = page
      .getByRole("button", { name: /ai insights/i })
      .or(page.getByText(/ai insights/i))
      .first();
    if (await aiInsightsModeBtn.isVisible()) {
      await aiInsightsModeBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/insights|blueprints|studio/i).first()).toBeVisible({
        timeout: 5000,
      });

      // Take snapshot in AI Insights mode
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "dashboard_ai_insights_mode.png"),
      });

      // Switch back to Static mode
      const staticModeBtn = page
        .getByRole("button", { name: /static/i })
        .or(page.getByText(/static/i))
        .first();
      await staticModeBtn.click();
      await page.waitForTimeout(500);
    }

    // 1.4 Test Context / Catalog dropdown
    const catalogSelector = page
      .locator("button:has-text('Default Workspace'), [role='combobox']")
      .first();
    if (await catalogSelector.isVisible()) {
      await catalogSelector.click();
      await page.waitForTimeout(300);
      // Close dropdown by pressing Escape or clicking body
      await page.keyboard.press("Escape");
    }

    // 1.5 Test Refresh Button
    const refreshBtn = page
      .locator("header button[title*='Refresh'], header button:has(svg.lucide-refresh-cw)")
      .first();
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await page.waitForTimeout(400);
    }

    // 1.6 Capture exhaustive static dashboard snapshot
    await page.screenshot({ path: path.join(__dirname, "snapshots", "dashboard_exhaustive.png") });
  });

  test("2. Investigation: should exercise all toolbar buttons, sidebars, toggles, and filters", async ({
    page,
  }) => {
    // 2.1 Navigate to Investigation
    const investigationTab = page
      .locator("button:has-text('server.log'), [data-testid='tab-server.log']")
      .first();
    if (await investigationTab.isVisible()) {
      await investigationTab.click();
    }
    await page.waitForTimeout(500);

    // 2.2 Verify & click Import Log button
    const importBtn = page.locator("button[title='Import Logs']").first();
    if (await importBtn.isVisible()) {
      await importBtn.click();
      await page.waitForTimeout(400);
      // Expect Import Modal
      await expect(page.getByText("Ingest Source").first()).toBeVisible();
      // Close modal by clicking close button
      const closeBtn = page.locator("[data-testid='close-import-modal']");
      await closeBtn.click();
      await expect(page.getByText("Ingest Source")).not.toBeVisible();
      await page.waitForTimeout(300);
    }

    // 2.3 Verify & Toggle Facet Sidebar
    const facetBtn = page.locator("button[title*='Facets']").first();
    if (await facetBtn.isVisible()) {
      await facetBtn.click();
      await page.waitForTimeout(400);
      // Take snapshot with Facets open
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "investigation_facets_open.png"),
      });
      // Toggle back
      await facetBtn.click();
      await page.waitForTimeout(300);
    }

    // 2.4 Verify & Toggle Column Manager
    const colManagerBtn = page.locator("button[title*='Column Manager']").first();
    if (await colManagerBtn.isVisible()) {
      await colManagerBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "investigation_column_manager_open.png"),
      });
      await colManagerBtn.click();
      await page.waitForTimeout(300);
    }

    // 2.5 Test Live Tail toggle
    const tailSwitch = page.locator("button[role='switch']").first();
    if (await tailSwitch.isVisible()) {
      await tailSwitch.click();
      await page.waitForTimeout(300);
      await tailSwitch.click();
    }

    // 2.6 Test Search Bar input
    const searchInput = page.locator("input[placeholder*='Search logs']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("level:INFO");
      await page.waitForTimeout(300);
      await searchInput.fill("");
    }

    // 2.7 Test Filter Builder button & popover
    const filterBtn = page
      .locator("button[title*='Add Filter'], button:has-text('Filter')")
      .first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
    }

    // 2.8 Test Saved Views / Bookmark dropdown
    const bookmarkBtn = page.locator("button[title*='Saved Filter']").first();
    if (await bookmarkBtn.isVisible()) {
      await bookmarkBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/save as view|load saved view/i).first()).toBeVisible();
      await page.keyboard.press("Escape");
    }

    // 2.9 Capture main Investigation view
    await page.screenshot({
      path: path.join(__dirname, "snapshots", "investigation_all_tools.png"),
    });
  });

  test("3. Settings: should navigate through EVERY section tab and verify options", async ({
    page,
  }) => {
    // 3.1 Navigate to Settings
    const settingsNavBtn = page.locator("button:has-text('Settings')").first();
    await expect(settingsNavBtn).toBeVisible();
    await settingsNavBtn.click();
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 25000 });
    const settingsLoader = page.locator("[data-testid='settings-loader']");
    if (await settingsLoader.isVisible()) {
      await settingsLoader.waitFor({ state: "detached", timeout: 25000 });
    }

    // Section 1: AI Intelligence
    const aiTab = page.locator("button:has-text('AI Intelligence')").first();
    await expect(aiTab).toBeVisible({ timeout: 15000 });
    await aiTab.click();
    await page.waitForTimeout(400);
    await expect(page.getByText("MODEL PROVIDER").first()).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, "snapshots", "settings_01_ai.png") });

    // Section 2: Knowledge RAG
    const ragTab = page.locator("button:has-text('Knowledge RAG')").first();
    await expect(ragTab).toBeVisible();
    await ragTab.click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/knowledge|rag|embedding|memory/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, "snapshots", "settings_02_rag.png") });

    // Section 3: Laya AI
    const layaTab = page.locator("button:has-text('Laya AI')").first();
    await expect(layaTab).toBeVisible();
    await layaTab.click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/laya|rules|decision/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, "snapshots", "settings_03_laya.png") });

    // Section 4: Engine Core (Drain3 clustering parameters)
    const engineTab = page.locator("button:has-text('Engine Core')").first();
    await expect(engineTab).toBeVisible();
    await engineTab.click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/clustering|drain|threshold/i).first()).toBeVisible();
    await page.screenshot({
      path: path.join(__dirname, "snapshots", "settings_04_engine_core.png"),
    });

    // Section 5: Ingestion
    const ingestionTab = page.locator("button:has-text('Ingestion')").first();
    await expect(ingestionTab).toBeVisible();
    await ingestionTab.click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/http listener|syslog/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, "snapshots", "settings_05_ingestion.png") });
  });

  test("4. AI Assistant Drawer: should exercise toggle, clear session, and input", async ({
    page,
  }) => {
    // 4.1 Toggle AI Assistant via Sparkles button or shortcut
    const aiSparklesBtn = page.locator("button[title*='AI Assistant']").first();
    if (await aiSparklesBtn.isVisible()) {
      await aiSparklesBtn.click();
    } else {
      await page.keyboard.press("Control+j");
    }
    await page.waitForTimeout(500);

    // 4.2 Verify Chat Header & New Investigation Button
    await expect(page.getByText(/ai investigator ready|investigation/i).first()).toBeVisible();
    const newChatBtn = page
      .locator("button[title*='New'], button:has-text('+'), button:has(svg.lucide-plus)")
      .first();
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(300);
    }

    // 4.3 Test Input Bar
    const chatInput = page
      .locator("textarea[placeholder*='Summarize'], input[placeholder*='Summarize']")
      .first();
    if (await chatInput.isVisible()) {
      await chatInput.fill("Analyze anomaly cluster #1");
      await page.waitForTimeout(200);
    }

    // 4.4 Capture AI Drawer snapshot
    await page.screenshot({
      path: path.join(__dirname, "snapshots", "ai_assistant_exhaustive.png"),
    });
  });
});
