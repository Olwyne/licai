import { test, expect } from "@playwright/test"

test.describe("Partage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("partage page renders", async ({ page }) => {
    await page.goto("/partage")
    await expect(page.getByRole("heading", { name: /partage|foyer|membres/i })).toBeVisible()
  })

  test("page shows members section with at least 1 member", async ({ page }) => {
    await page.goto("/partage")
    // Members section heading
    await expect(page.getByText(/membres|member/i).first()).toBeVisible()
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
