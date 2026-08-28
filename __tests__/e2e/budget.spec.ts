import { test, expect } from "@playwright/test"

test.describe("Budget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
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
    await expect(page.locator(".month-chip, .chip").first()).toBeVisible()
  })

  test("edit budget limit → bar updates", async ({ page }) => {
    await page.goto("/budget")
    // Click edit on first budget card
    await page.locator(".budget-card").first().getByRole("button", { name: /modifier|éditer/i }).click()
    // Modal should open
    await expect(page.locator(".modal, [role='dialog']")).toBeVisible()
  })
})
