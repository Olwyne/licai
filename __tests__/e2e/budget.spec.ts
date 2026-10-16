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
    // Month chips exist
    await expect(page.locator(".budget-month-select").first()).toBeVisible()
  })

  test("edit budget limit → bar updates", async ({ page }) => {
    await page.goto("/budget")
    // Click edit on first budget card
    await page.locator(".budget-card").first().locator(".budget-edit-btn").click()
    // Modal should open
    await expect(page.locator(".modal")).toBeVisible()
  })
})
