import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Patrimoine", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("patrimoine page renders with heading", async ({ page }) => {
    await page.goto("/patrimoine")
    await expect(page.getByRole("heading", { name: /patrimoine/i })).toBeVisible()
  })

  test("add property → card appears, then delete it", async ({ page }) => {
    await page.goto("/patrimoine")
    await page.getByRole("button", { name: /ajouter un bien/i }).click()
    const modal = page.locator(".modal")
    await expect(modal).toBeVisible()
    await modal.locator(".field", { hasText: /^Nom/ }).locator("input").first().fill("Maison E2E")
    await modal.locator(".field", { hasText: "Prix d'achat" }).locator("input").fill("250000")
    await modal.locator(".field", { hasText: "Valeur actuelle" }).locator("input").first().fill("300000")
    await modal.getByRole("button", { name: /ajouter le bien/i }).click()
    await expect(page.getByText("Maison E2E").first()).toBeVisible()

    await page.locator(".prop-card", { hasText: "Maison E2E" }).click()
    await page.locator(".modal").getByRole("button", { name: /supprimer/i }).click()
    const confirmBtn = page.locator(".modal").getByRole("button", { name: /confirmer|oui|supprimer/i })
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click()
    await expect(page.getByText("Maison E2E")).toHaveCount(0)
  })

  test("add credit (Crédits page) → row appears", async ({ page }) => {
    await page.goto("/credits")
    await page.getByRole("button", { name: /ajouter un crédit/i }).click()
    const modal = page.locator(".modal")
    await expect(modal).toBeVisible()
    await modal.locator(".field", { hasText: "Intitulé" }).locator("input").fill("Crédit E2E")
    await modal.locator(".field", { hasText: "Montant emprunté" }).locator("input").fill("150000")
    await modal.locator(".field", { hasText: "Capital restant dû" }).locator("input").fill("100000")
    await modal.locator(".field", { hasText: "Mensualité" }).locator("input").fill("800")
    await modal.locator(".field", { hasText: "Taux annuel" }).locator("input").fill("2.5")
    await modal.getByRole("button", { name: /enregistrer/i }).click()
    await expect(page.getByText("Crédit E2E").first()).toBeVisible()
  })
})
