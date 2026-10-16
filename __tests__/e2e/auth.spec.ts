import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Auth", () => {
  test("login with valid credentials → redirects to dashboard", async ({ page }) => {
    await loginOk(page)
    await expect(page.getByRole("heading", { name: /bonjour/i })).toBeVisible()
  })

  test("login with wrong password → shows error", async ({ page }) => {
    await page.goto("/login")
    await page.locator('input[type="email"]').fill("sophie@lambert.fr")
    await page.locator('input[type="password"]').fill("wrongpassword")
    await page.getByRole("button", { name: /se connecter/i }).click()
    await expect(page.getByText(/invalide|incorrect|erreur/i)).toBeVisible()
    await expect(page).toHaveURL(/login/)
  })

  test("unauthenticated access to dashboard → redirects to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/login/)
  })

  test("logout → redirects to login", async ({ page }) => {
    // Login first
    await loginOk(page)

    await page.goto("/parametres")
    await page.getByRole("button", { name: /se déconnecter/i }).click()
    await expect(page).toHaveURL(/login/)
  })
})
