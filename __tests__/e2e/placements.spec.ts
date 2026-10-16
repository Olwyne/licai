import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Placements", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("placements page renders", async ({ page }) => {
    await page.goto("/placements")
    await expect(page.getByRole("heading", { name: /placements/i })).toBeVisible()
  })

  test("page shows the portfolio blocks of the design", async ({ page }) => {
    await page.goto("/placements")
    for (const t of [/portefeuille vs indice/i, /allocation vs cible/i, /conseils & rééquilibrage/i, /lignes du portefeuille/i, /simulation fiscale/i]) {
      await expect(page.getByText(t).first()).toBeVisible()
    }
  })

  test("KPIs show valorisation and plus-value latente", async ({ page }) => {
    await page.goto("/placements")
    await expect(page.locator(".metric-label", { hasText: "Valorisation" })).toBeVisible()
    await expect(page.locator(".metric-label", { hasText: "Plus-value latente" })).toBeVisible()
  })

  test("add a line → appears in the table, then delete it", async ({ page }) => {
    await page.goto("/placements")
    await page.getByText("Ajouter une ligne", { exact: true }).click()
    const modal = page.locator(".modal")
    await expect(modal).toBeVisible()
    await modal.locator(".field", { hasText: "Nom du support" }).locator("input").fill("Ligne E2E")
    await modal.locator(".field", { hasText: "Quantité" }).locator("input").fill("5")
    await modal.locator(".field", { hasText: "Cours actuel" }).locator("input").fill("100")
    await modal.getByRole("button", { name: /ajouter la ligne/i }).click()
    await expect(page.getByText("Ligne E2E")).toBeVisible()

    await page.getByText("Ligne E2E").click()
    await page.locator(".modal").getByRole("button", { name: /supprimer/i }).click()
    await expect(page.getByText("Ligne E2E")).not.toBeVisible()
  })

  test("quote source modal opens", async ({ page }) => {
    await page.goto("/placements")
    await page.getByRole("button", { name: /cours/i }).first().click()
    await expect(page.getByRole("heading", { name: /cours des supports/i })).toBeVisible()
  })
})
