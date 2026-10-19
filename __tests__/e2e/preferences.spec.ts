import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Préférences enregistrées dans le navigateur", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("le thème clair est conservé après rechargement", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await page.locator(".sidebar").getByRole("button", { name: /mode clair/i }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await page.locator(".sidebar").getByRole("button", { name: /mode sombre/i }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  })

  test("« Cacher les chiffres » masque les montants et reste actif après rechargement", async ({ page }) => {
    await page.goto("/comptes")
    await page.locator(".sidebar").getByRole("button", { name: /cacher les chiffres/i }).click()
    await expect(page.locator(".sidebar").getByRole("button", { name: /afficher les chiffres/i })).toBeVisible()
    await page.reload()
    await expect(page.locator(".sidebar").getByRole("button", { name: /afficher les chiffres/i })).toBeVisible()
    await page.locator(".sidebar").getByRole("button", { name: /afficher les chiffres/i }).click()
    await expect(page.locator(".sidebar").getByRole("button", { name: /cacher les chiffres/i })).toBeVisible()
  })

  test("la palette de recherche repart vide à chaque ouverture", async ({ page }) => {
    await page.goto("/dashboard")
    await page.locator(".sidebar").getByRole("button", { name: /rechercher/i }).click()
    const input = page.getByPlaceholder(/rechercher/i).last()
    await input.fill("loyer")
    await expect(input).toHaveValue("loyer")
    await page.keyboard.press("Escape")
    await expect(input).toHaveCount(0)
    await page.locator(".sidebar").getByRole("button", { name: /rechercher/i }).click()
    await expect(page.getByPlaceholder(/rechercher/i).last()).toHaveValue("")
  })

  test("les hypothèses de capacité d'emprunt et le profil d'investisseur sont conservés", async ({ page }) => {
    await page.goto("/credits")
    const rate = page.locator(".fi-field", { hasText: "Taux envisagé" }).locator("input")
    await rate.fill("4,1")
    await page.reload()
    await expect(page.locator(".fi-field", { hasText: "Taux envisagé" }).locator("input")).toHaveValue("4,1")
    await page.locator(".fi-field", { hasText: "Taux envisagé" }).locator("input").fill("3,4")

    await page.goto("/placements")
    await page.getByRole("button", { name: "Dynamique", exact: true }).click()
    await page.reload()
    await expect(page.getByRole("button", { name: "Dynamique", exact: true })).toHaveClass(/active/)
    await page.getByRole("button", { name: "Équilibré", exact: true }).click()
  })

  test("la clé de répartition du foyer est conservée", async ({ page }) => {
    await page.goto("/partage")
    await page.getByRole("button", { name: "Parts égales" }).click()
    await expect(page.getByRole("button", { name: "Parts égales" })).toHaveClass(/on/)
    await page.reload()
    await expect(page.getByRole("button", { name: "Parts égales" })).toHaveClass(/on/)
    await page.getByRole("button", { name: "Au prorata des revenus" }).click()
  })

  test("le lien d'import des comptes ouvre l'assistant d'import", async ({ page }) => {
    await page.goto("/transactions?import=1")
    await expect(page.locator(".modal")).toBeVisible()
  })
})
