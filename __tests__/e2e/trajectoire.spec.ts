import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Trajectoire", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("trajectoire page renders", async ({ page }) => {
    await page.goto("/trajectoire")
    await expect(page.getByRole("heading", { name: /trajectoire|projection/i })).toBeVisible()
  })

  test("chart section is visible", async ({ page }) => {
    await page.goto("/trajectoire")
    // Either a canvas element (Chart.js) or a chart container div
    const chart = page.locator(
      "canvas, [class*='chart'], [class*='Chart'], svg[class*='chart'], [data-testid*='chart']"
    ).first()
    await expect(chart).toBeVisible()
  })

  test("composition and horizon toggles render", async ({ page }) => {
    await page.goto("/trajectoire")
    await expect(page.getByText("Composition", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "24 mois + projection" })).toBeVisible()
  })
})
