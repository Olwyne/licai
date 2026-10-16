import { test, expect } from "@playwright/test"

test.describe("Inscription & accès", () => {
  test("setup page reachable and creates a new household", async ({ page }) => {
    const email = `new-${Date.now()}@example.fr`
    await page.goto("/setup")
    await expect(page.getByRole("heading", { name: /créer un compte/i })).toBeVisible()
    await page.locator("#fn").fill("Camille")
    await page.locator("#ln").fill("Durand")
    await page.locator("#house").fill("Foyer Durand")
    await page.locator("#email").fill(email)
    await page.locator("#pw").fill("trop-court")
    await page.locator('input[type="checkbox"]').nth(1).check()
    await page.locator('input[type="checkbox"]').nth(2).check()
    await page.getByRole("button", { name: /créer mon foyer/i }).click()
    await expect(page.getByText(/au moins 12 caractères/i).last()).toBeVisible()
    await page.locator("#pw").fill("Motdepasse-2026")
    await page.getByRole("button", { name: /créer mon foyer/i }).click()
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.getByRole("heading", { name: /bonjour, camille/i })).toBeVisible()
  })

  test("forgot password page answers generically", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("link", { name: /mot de passe oublié/i }).click()
    await page.locator("#email").fill("inconnu@example.fr")
    await page.getByRole("button", { name: /envoyer le lien/i }).click()
    await expect(page.getByText(/si un compte existe/i)).toBeVisible()
  })

  test("demo button opens the demo household", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: /explorer la démonstration/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 60000 })
  })

  test("legal pages are public", async ({ page }) => {
    const res = await page.goto("/legal/conditions.html")
    expect(res?.status()).toBe(200)
    await expect(page).toHaveURL(/conditions/)
  })
})
