import { test, expect } from "@playwright/test"

test.describe("Trajectoire", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
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

  test("member chips render", async ({ page }) => {
    await page.goto("/trajectoire")
    // Member chips / filter buttons for household members
    const chips = page.locator(
      "[class*='chip'], [class*='member'], [class*='avatar'], button"
    ).filter({ hasText: /sophie|lambert|membre/i })
    await expect(chips.first()).toBeVisible()
  })
})
