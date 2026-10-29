import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("greets the user in the page title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /bonjour/i })).toBeVisible()
    await expect(page.getByText(/tableau de bord & rapports du foyer/i)).toBeVisible()
  })

  test("shows the month summary and the 4 KPI cards", async ({ page }) => {
    await expect(page.getByRole("region", { name: "Situation du mois" }).getByRole("heading", { name: "Reste à vivre" })).toBeVisible()
    await expect(page.locator(".metric")).toHaveCount(4)
    await expect(page.getByText("Revenus du foyer").first()).toBeVisible()
    await expect(page.getByText("Patrimoine net", { exact: true }).first()).toBeVisible()
  })

  test("shows every block of the design", async ({ page }) => {
    for (const t of [
      "Placements financiers", "Revenus vs dépenses", "Chiffres clés", "Détail mensuel", "Évolution de la trésorerie",
      "Répartition du foyer", "Budget du mois", "Plus grosses dépenses", "Objectifs à court terme", "Prochaines échéances",
      "Patrimoine & dettes", "Signaux du mois", "Dernières transactions",
    ]) {
      await expect(page.getByText(t, { exact: true }).first()).toBeVisible()
    }
  })

  test("period chips update the range label", async ({ page }) => {
    await page.getByRole("button", { name: "1 semaine" }).click()
    await expect(page.locator(".ov-range-label")).toContainText("→")
    await page.getByRole("button", { name: "Trimestres" }).click()
    await expect(page.locator(".ov-range-label")).toContainText(/trimestres/i)
  })

  test("custom period modal applies a range", async ({ page }) => {
    await page.getByRole("button", { name: /période/i }).click()
    await expect(page.getByRole("heading", { name: /choisir une période/i })).toBeVisible()
    await page.getByRole("button", { name: "30 jours" }).click()
    await page.getByRole("button", { name: /appliquer/i }).click()
    await expect(page.locator(".ov-range-label")).toContainText("→")
  })

  test("last transactions section shows rows", async ({ page }) => {
    await expect(page.locator(".tx-row").first()).toBeVisible()
  })
})
