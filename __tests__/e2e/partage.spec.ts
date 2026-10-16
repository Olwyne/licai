import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Partage", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("partage page renders", async ({ page }) => {
    await page.goto("/partage")
    await expect(page.getByRole("heading", { name: /répartition du foyer/i })).toBeVisible()
  })

  test("page shows members section with at least 1 member", async ({ page }) => {
    await page.goto("/partage")
    // Members section heading
    await expect(page.getByText(/revenus du foyer/i).first()).toBeVisible()
    // At least one member item visible (Sophie Lambert is seeded)
    const members = page.locator(
      "[class*='member'], [class*='user'], tr, li"
    ).filter({ hasText: /sophie|lambert/i })
    await expect(members.first()).toBeVisible()
  })

  test("balance section renders", async ({ page }) => {
    await page.goto("/partage")
    // Balance section should be present even if amounts are 0
    await expect(page.getByText(/balance|solde|équilibre|répartition/i).first()).toBeVisible()
  })
})
