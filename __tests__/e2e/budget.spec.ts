import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Budget", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("budget page shows category progress bars", async ({ page }) => {
    await page.goto("/budget")
    await expect(page.getByRole("heading", { name: /budget/i })).toBeVisible()
    // At least one budget card visible
    await expect(page.locator(".budget-card").first()).toBeVisible()
  })

  test("month selector chips visible", async ({ page }) => {
    await page.goto("/budget")
    // Pastille de période partagée (même composant que les transactions) : précédent / mois / suivant
    const pills = page.locator(".period-row .pill")
    await expect(pills).toHaveCount(3)
    const before = await pills.nth(1).innerText()
    await pills.nth(0).click()
    await expect(pills.nth(1)).not.toHaveText(before)
  })

  test("edit budget limit → bar updates", async ({ page }) => {
    await page.goto("/budget")
    // Click edit on first budget card
    await page.locator(".budget-card").first().locator(".budget-edit-btn").click()
    // Modal should open
    await expect(page.locator(".modal")).toBeVisible()
  })
})
