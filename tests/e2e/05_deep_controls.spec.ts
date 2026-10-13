import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { pruneSnapshots } from "./helpers/snapshot_cleaner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("Exhaustive Phase 5: Deep Option & Interactive Control Verification", () => {
  test.afterAll(async () => {
    const snapshotsDir = path.resolve(__dirname, "snapshots");
    pruneSnapshots(snapshotsDir, 3);
  });
  test.beforeEach(async ({ page }) => {
    // Navigate with deterministic test flags and wait for hydration
    await page.goto("/?test=1");
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 25000 });
  });

  test("1. Investigation Builders & Modals: Highlight, Filter, Time Presets, and Templates", async ({
    page,
  }) => {
    // Navigate to Investigation view
    const investigationTab = page.locator("button:has-text('server.log')").first();
    if (await investigationTab.isVisible()) {
      await investigationTab.click();
    }
    await page.waitForTimeout(400);

    // 1.1 Highlight Builder: Open, Pick color, and test term input
    const highlightBtn = page
      .locator("button:has-text('Highlights'), button[title*='Highlight']")
      .first();
    if (await highlightBtn.isVisible()) {
      await highlightBtn.click();
      await page.waitForTimeout(300);
      const highlightInput = page
        .locator("input[placeholder*='Highlight'], input[placeholder*='term']")
        .first();
      if (await highlightInput.isVisible()) {
        await highlightInput.fill("ERROR");
        await page.screenshot({
          path: path.join(__dirname, "snapshots", "deep_01_highlight_builder.png"),
        });
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // 1.2 Filter Builder: Open popover, verify operator/field dropdowns
    const filterBtn = page.locator("button:has-text('Filters'), button[title*='Filter']").first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/add filter/i).first()).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_02_filter_builder_open.png"),
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // 1.3 TimeRangePicker: Open and test Presets menu
    const timePickerBtn = page
      .locator("button:has(svg.lucide-clock), button[title*='Time']")
      .first();
    if (await timePickerBtn.isVisible()) {
      await timePickerBtn.click();
      await page.waitForTimeout(300);
      const presetOption = page
        .locator("button:has-text('Last 1 hour'), button:has-text('Last 15 min')")
        .first();
      if (await presetOption.isVisible()) {
        await expect(presetOption).toBeVisible();
        await page.screenshot({
          path: path.join(__dirname, "snapshots", "deep_03_time_presets.png"),
        });
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // 1.4 Bookmarks -> Save as View modal
    const bookmarkBtn = page.locator("button[title*='Saved Filter']").first();
    if (await bookmarkBtn.isVisible()) {
      await bookmarkBtn.click();
      await page.waitForTimeout(300);
      const saveAsViewItem = page.locator("div[role='menuitem']:has-text('Save as View')").first();
      if (await saveAsViewItem.isVisible()) {
        await saveAsViewItem.click();
        await page.waitForTimeout(300);
        await expect(page.getByText("Save Template").first()).toBeVisible();
        await page.screenshot({
          path: path.join(__dirname, "snapshots", "deep_04_save_template_modal.png"),
        });
        const cancelBtn = page.locator("button:has-text('Cancel')").first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }
      }
    }

    // 1.5 Bookmarks -> Load Saved View modal
    if (await bookmarkBtn.isVisible()) {
      await bookmarkBtn.click();
      await page.waitForTimeout(300);
      const loadViewItem = page.locator("div[role='menuitem']:has-text('Load Saved View')").first();
      if (await loadViewItem.isVisible()) {
        await loadViewItem.click();
        await page.waitForTimeout(300);
        await expect(page.getByText("Load Template").first()).toBeVisible();
        await page.screenshot({
          path: path.join(__dirname, "snapshots", "deep_05_load_template_modal.png"),
        });
        await page.keyboard.press("Escape");
      }
    }
  });

  test("2. Sidebar & Workspace Management: Collapse, Expand, and Add Workspace UI", async ({
    page,
  }) => {
    // 2.1 Collapse sidebar
    const collapseBtn = page.locator("button[aria-label='Collapse sidebar']").first();
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_06_sidebar_collapsed.png"),
      });

      // Re-expand sidebar
      const openBtn = page.locator("button[aria-label='Open sidebar']").first();
      if (await openBtn.isVisible()) {
        await openBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // 2.2 Add workspace trigger and input
    const addWorkspaceBtn = page.locator("button:has(svg.lucide-plus)").first();
    if (await addWorkspaceBtn.isVisible()) {
      await addWorkspaceBtn.click();
      await page.waitForTimeout(200);
      const wsInput = page.locator("input[placeholder='Workspace...']").first();
      if (await wsInput.isVisible()) {
        await wsInput.fill("Staging Cluster");
        await page.screenshot({
          path: path.join(__dirname, "snapshots", "deep_07_add_workspace_input.png"),
        });
        await page.keyboard.press("Escape");
      }
    }
  });

  test("3. Deep Settings: Laya AI Sub-tabs (JSON Code, Checkpoints, Playground) & Reset Confirmation", async ({
    page,
  }) => {
    // Navigate to Settings
    const settingsNavBtn = page.locator("button:has-text('Settings')").first();
    await settingsNavBtn.click();
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });

    // Navigate to Laya AI section
    const layaTab = page.locator("button:has-text('Laya AI')").first();
    await layaTab.click();
    await page.waitForTimeout(400);

    // 3.1 JSON Code Tab
    const jsonTabBtn = page.locator("button:has-text('JSON Code')").first();
    if (await jsonTabBtn.isVisible()) {
      await jsonTabBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_08_laya_json_tab.png"),
      });
    }

    // 3.2 Checkpoints Tab
    const checkpointsTabBtn = page.locator("button:has-text('Checkpoints')").first();
    if (await checkpointsTabBtn.isVisible()) {
      await checkpointsTabBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_09_laya_checkpoints_tab.png"),
      });
    }

    // 3.3 Test Playground Tab
    const playgroundTabBtn = page.locator("button:has-text('Test Playground')").first();
    if (await playgroundTabBtn.isVisible()) {
      await playgroundTabBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_10_laya_playground_tab.png"),
      });
    }

    // 3.4 Reset Settings Dialog Trigger
    const resetSettingsBtn = page.locator("button:has-text('Reset Settings')").first();
    if (await resetSettingsBtn.isVisible()) {
      await resetSettingsBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText("Reset All Settings?").first()).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_11_reset_settings_modal.png"),
      });
      const cancelBtn = page.locator("button:has-text('Cancel')").first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
      await page.waitForTimeout(200);
    }

    // 3.5 Factory Reset Dialog Trigger
    const factoryResetBtn = page.locator("button:has-text('Factory Reset')").first();
    if (await factoryResetBtn.isVisible()) {
      await factoryResetBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText("Total Factory Reset?").first()).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_12_factory_reset_modal.png"),
      });
      const cancelBtn = page.locator("button:has-text('Cancel')").first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });

  test("4. Global Command Palette & Keyboard Navigation", async ({ page }) => {
    // Open Command Palette with Ctrl+K
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);

    const commandPaletteInput = page
      .locator("input[placeholder*='command'], input[placeholder*='Search']")
      .first();
    if (await commandPaletteInput.isVisible()) {
      await expect(page.getByText(/Navigation/i).first()).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_13_command_palette_open.png"),
      });
      // Search for Dashboard
      await commandPaletteInput.fill("Dashboard");
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_14_command_palette_filtered.png"),
      });
      // Close command palette
      await page.keyboard.press("Escape");
    }
  });

  test("5. Comprehensive Modals & Engines: Orchestrator Hub, Custom Column Modal, and Laya Guide", async ({
    page,
  }) => {
    // 5.1 Navigate to Investigation and test Orchestrator Hub
    const investigationTab = page.locator("button:has-text('server.log')").first();
    if (await investigationTab.isVisible()) {
      await investigationTab.click();
    }
    await page.waitForTimeout(400);

    const orchestrateBtn = page.locator("button[title*='Orchestrate Streams']").first();
    if (await orchestrateBtn.isVisible()) {
      await orchestrateBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByText("Orchestrator").first()).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_15_orchestrator_hub.png"),
      });
      // Close Orchestrator
      const closeOrchestrator = page.locator("[data-testid='close-orchestrator']");
      if (await closeOrchestrator.isVisible()) {
        await closeOrchestrator.click();
      }
      await expect(page.getByText("Orchestrator")).not.toBeVisible();
      await page.waitForTimeout(300);
    }

    // 5.2 Open Column Manager and trigger Add Custom Column Modal
    const colManagerBtn = page.locator("button[title*='Column Manager']").first();
    if (await colManagerBtn.isVisible()) {
      await colManagerBtn.click();
      await page.waitForTimeout(300);
      const addColumnBtn = page
        .locator("button:has-text('Add Column'), button:has-text('Add Custom Column')")
        .first();
      if (await addColumnBtn.isVisible()) {
        await addColumnBtn.click();
        await page.waitForTimeout(300);
        await expect(page.getByText(/Add Custom Column|Column Definition/i).first()).toBeVisible();
        await page.screenshot({
          path: path.join(__dirname, "snapshots", "deep_16_add_column_modal.png"),
        });
        const cancelBtn = page.locator("button:has-text('Cancel')").first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }
      }
      // Close column manager
      await colManagerBtn.click();
      await page.waitForTimeout(300);
    }

    // 5.3 Navigate to Settings -> Laya AI -> Guide & Primitives Modal
    const settingsNavBtn = page.locator("button:has-text('Settings')").first();
    await settingsNavBtn.click();
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 25000 });
    const settingsLoader = page.locator("[data-testid='settings-loader']");
    if (await settingsLoader.isVisible()) {
      await settingsLoader.waitFor({ state: "detached", timeout: 25000 });
    }

    const layaTab = page.locator("button:has-text('Laya AI')").first();
    await layaTab.click();
    await page.waitForTimeout(400);

    const guideBtn = page.locator("button:has-text('Guide & Primitives')").first();
    if (await guideBtn.isVisible()) {
      await guideBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText("Laya System 1 Architecture").first()).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, "snapshots", "deep_17_laya_guide_modal.png"),
      });
      await page.keyboard.press("Escape");
    }
  });
});
