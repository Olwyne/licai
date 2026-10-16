import { expect, type Page } from "@playwright/test"
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup"

export async function login(page: Page, email = E2E_EMAIL, password = E2E_PASSWORD) {
  await page.goto("/login")
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole("button", { name: /se connecter/i }).click()
}

export async function loginOk(page: Page) {
  await login(page)
  await expect(page).toHaveURL(/dashboard/)
}
