import { test, expect } from "@playwright/test"

test.describe("Onboarding d'un foyer vide", () => {
  test.beforeEach(async ({ page }) => {
    const email = `onb-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.fr`
    await page.goto("/setup")
    await page.locator("#fn").fill("Alex")
    await page.locator("#ln").fill("Martin")
    await page.locator("#house").fill("Foyer Martin")
    await page.locator("#email").fill(email)
    await page.locator("#pw").fill("Motdepasse-2026")
    await page.locator('input[type="checkbox"]').nth(1).check()
    await page.locator('input[type="checkbox"]').nth(2).check()
    await page.getByRole("button", { name: /créer mon foyer/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("carte « Premiers pas » affichée puis masquable", async ({ page }) => {
    const card = page.getByTestId("first-steps")
    await expect(card).toBeVisible()
    await card.getByRole("button", { name: /masquer|fermer/i }).first().click()
    await expect(card).toBeHidden()
    await page.reload()
    await expect(page.getByTestId("first-steps")).toBeHidden()
  })

  test("budget vide : un préchoix ouvre la catégorie préremplie", async ({ page }) => {
    await page.goto("/budget")
    await expect(page.getByTestId("budget-empty")).toBeVisible()
    await page.getByTestId("budget-empty").getByRole("button", { name: /alimentation/i }).click()
    await expect(page.locator(".modal")).toBeVisible()
    await expect(page.getByPlaceholder("ex. Éducation")).toHaveValue("Alimentation")
  })
})
