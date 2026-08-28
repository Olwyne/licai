import { test, expect } from "@playwright/test"

test.describe("Prévoyance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("prevoyance page renders", async ({ page }) => {
    await page.goto("/prevoyance")
    await expect(page.getByRole("heading", { name: /prévoyance/i })).toBeVisible()
  })

  test("add contract → row appears", async ({ page }) => {
    await page.goto("/prevoyance")
    await page.getByRole("button", { name: /ajouter/i }).click()

    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Assurance Vie")
    await page.getByLabel(/assureur|compagnie/i).fill("AXA")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "vie" }).catch(async () => {
      await page.getByRole("option", { name: /vie/i }).click()
    })
    await page.getByLabel(/valeur|capital/i).fill("50000")
    await page.getByLabel(/prime|cotisation|monthly|mensuel/i).fill("200")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()

    await expect(page.getByText("Assurance Vie")).toBeVisible()
  })

  test("delete contract → row disappears", async ({ page }) => {
    // Add a contract first
    await page.goto("/prevoyance")
    await page.getByRole("button", { name: /ajouter/i }).click()
    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Contrat à Supprimer")
    await page.getByLabel(/assureur|compagnie/i).fill("MAIF")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "vie" }).catch(async () => {
      await page.getByRole("option", { name: /vie/i }).click()
    })
    await page.getByLabel(/valeur|capital/i).fill("10000")
    await page.getByLabel(/prime|cotisation|monthly|mensuel/i).fill("100")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()
    await expect(page.getByText("Contrat à Supprimer")).toBeVisible()

    // Delete
    const row = page.locator("tr, li").filter({ hasText: "Contrat à Supprimer" }).first()
    await row.getByRole("button", { name: /supprimer|effacer|delete/i }).click()

    const confirmBtn = page.getByRole("button", { name: /confirmer|oui|supprimer/i })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    await expect(page.getByText("Contrat à Supprimer")).not.toBeVisible()
  })
})
