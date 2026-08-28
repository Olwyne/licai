import { test, expect } from "@playwright/test"

test.describe("Auth", () => {
  test("login with valid credentials → redirects to dashboard", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible()
  })

  test("login with wrong password → shows error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("wrongpassword")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page.getByText(/invalide|incorrect|erreur/i)).toBeVisible()
    await expect(page).toHaveURL(/login/)
  })

  test("unauthenticated access to dashboard → redirects to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/login/)
  })

  test("logout → redirects to login", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)

    // Logout via topbar
    await page.getByRole("button", { name: /déconnexion|logout/i }).click()
    await expect(page).toHaveURL(/login/)
  })
})
