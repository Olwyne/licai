import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Impôts", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("impots page renders", async ({ page }) => {
    await page.goto("/impots")
    await expect(page.getByRole("heading", { name: /impôts/i })).toBeVisible()
  })

  test("page shows the tax blocks of the design", async ({ page }) => {
    await page.goto("/impots")
    for (const t of [/du revenu brut à l.impôt/i, /pistes d.optimisation/i, /scénarios comparés/i, /barème par tranche/i, /composition des revenus/i]) {
      await expect(page.getByText(t).first()).toBeVisible()
    }
  })

  test("page shows the IR amount in euros", async ({ page }) => {
    await page.goto("/impots")
    await expect(page.getByText("Impôt sur le revenu", { exact: true })).toBeVisible()
    await expect(page.getByText(/€/).first()).toBeVisible()
  })

  test("changing the tax situation recalculates and persists", async ({ page }) => {
    await page.goto("/impots")
    await page.getByRole("button", { name: /^\W*Situation fiscale$/ }).click()
    await expect(page.getByRole("heading", { name: /situation fiscale du foyer/i })).toBeVisible()
    await page.locator(".modal .field", { hasText: "Dons aux associations" }).locator("input").fill("1000")
    await page.getByRole("button", { name: /recalculer/i }).click()
    await expect(page.getByRole("heading", { name: /situation fiscale du foyer/i })).not.toBeVisible()
    await page.reload()
    await page.getByRole("button", { name: /^\W*Situation fiscale$/ }).click()
    await expect(page.locator(".modal .field", { hasText: "Dons aux associations" }).locator("input")).toHaveValue("1000")
  })
})
