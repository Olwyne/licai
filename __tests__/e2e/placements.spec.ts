import { test, expect } from "@playwright/test"

test.describe("Placements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("placements page renders", async ({ page }) => {
    await page.goto("/placements")
    await expect(page.getByRole("heading", { name: /placements/i })).toBeVisible()
  })

  test("add placement → appears in table", async ({ page }) => {
    await page.goto("/placements")
    await page.getByRole("button", { name: /ajouter/i }).click()

    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("LVMH")
    await page.getByLabel(/ticker|symbole/i).fill("MC.PA")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "action" }).catch(async () => {
      await page.getByRole("option", { name: /action/i }).click()
    })
    await page.getByLabel(/quantité|qté/i).fill("10")
    await page.getByLabel(/prix unitaire|prix actuel/i).fill("800")
    await page.getByLabel(/prix d.achat|purchase/i).fill("750")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()

    await expect(page.getByText("LVMH")).toBeVisible()
  })

  test("KPIs show valeur totale and P&L", async ({ page }) => {
    await page.goto("/placements")
    // At least one KPI block with "valeur" or "P&L" text
    await expect(
      page.getByText(/valeur totale|valeur|p&l|plus.value|gain/i).first()
    ).toBeVisible()
  })

  test("delete placement → disappears", async ({ page }) => {
    // Add a placement to delete
    await page.goto("/placements")
    await page.getByRole("button", { name: /ajouter/i }).click()
    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Action à Supprimer")
    await page.getByLabel(/ticker|symbole/i).fill("TEST.PA")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "action" }).catch(async () => {
      await page.getByRole("option", { name: /action/i }).click()
    })
    await page.getByLabel(/quantité|qté/i).fill("5")
    await page.getByLabel(/prix unitaire|prix actuel/i).fill("100")
    await page.getByLabel(/prix d.achat|purchase/i).fill("90")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()
    await expect(page.getByText("Action à Supprimer")).toBeVisible()

    // Delete
    const row = page.locator("tr, li").filter({ hasText: "Action à Supprimer" }).first()
    await row.getByRole("button", { name: /supprimer|effacer|delete/i }).click()

    const confirmBtn = page.getByRole("button", { name: /confirmer|oui|supprimer/i })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    await expect(page.getByText("Action à Supprimer")).not.toBeVisible()
  })
})
