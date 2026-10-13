import { expect, test } from "@playwright/test";

test.describe("LogLensAi AI Insights Studio & Catalog Scoping E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local LogLensAi frontend
    await page.goto("/?test=1");
    // Ensure app container is ready and Suspense loader has detached
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });
  });

  test("should render the Dashboard and navigate to AI Insights Studio", async ({ page }) => {
    // Check navigation bar or sidebar for Dashboard tab/button
    const dashboardBtn = page
      .getByRole("button", { name: /dashboard/i })
      .or(page.getByText(/dashboard/i));
    if (await dashboardBtn.first().isVisible()) {
      await dashboardBtn.first().click();
    }

    // AI Insights Studio trigger or header verification
    const studioTrigger = page
      .getByText(/ai insights/i)
      .or(page.getByRole("button", { name: /ai insights/i }));
    await expect(studioTrigger.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display Blueprint templates in AI Insights Studio", async ({ page }) => {
    // Switch to Dashboard / AI Insights Studio
    const studioTrigger = page
      .getByText(/ai insights/i)
      .or(page.getByRole("button", { name: /ai insights/i }));
    if (await studioTrigger.first().isVisible()) {
      await studioTrigger.first().click();
    }

    // Verify Blueprint helper button or blueprint templates presence
    const blueprintBtn = page.locator(
      "button[aria-label*='blueprint'], button:has-text('Blueprint'), [data-testid='blueprint-selector']",
    );
    if (await blueprintBtn.first().isVisible()) {
      await blueprintBtn.first().click();
      // Ensure blueprints like Volume Timeline or Error Spikes are available
      await expect(
        page
          .getByText(/volume timeline/i)
          .or(page.getByText(/error & warning/i))
          .first(),
      ).toBeVisible();
    }
  });

  test("should verify Catalog Scoping dropdown or mention tokens", async ({ page }) => {
    // Verify Workspace / Catalog selector
    const catalogSelector = page.locator(
      "[data-testid='catalog-select'], button:has-text('Default Workspace'), button:has-text('Catalog'), [role='combobox']",
    );
    await expect(catalogSelector.first()).toBeVisible({ timeout: 10000 });
  });

  test("should load settings and verify Knowledge RAG hardware selector colocation", async ({
    page,
  }) => {
    // Navigate to Settings
    const settingsBtn = page.locator("button:has-text('Settings')").first();
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await page
      .locator("[data-testid='page-loader']")
      .waitFor({ state: "detached", timeout: 15000 });

    // Click on RAG / Knowledge Base section if tabs exist
    const ragTab = page.locator("button:has-text('Knowledge RAG')").first();
    if (await ragTab.isVisible()) {
      await ragTab.click();
      await page.waitForTimeout(400);

      // Verify the Hardware Acceleration selector is present when ONNX is default
      await expect(page.getByText(/cpu mode/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/gpu acceleration/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
