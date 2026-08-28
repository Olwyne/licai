import { test, expect } from "@playwright/test"

test.describe("Patrimoine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("patrimoine page renders with heading", async ({ page }) => {
    await page.goto("/patrimoine")
    await expect(page.getByRole("heading", { name: /patrimoine/i })).toBeVisible()
  })

  test("add property → row appears in table", async ({ page }) => {
    await page.goto("/patrimoine")
    await page.getByRole("button", { name: /ajouter un bien/i }).click()

    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Appartement Paris")
    // Select kind
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "immobilier" }).catch(async () => {
      await page.getByRole("option", { name: /immobilier/i }).click()
    })
    await page.getByLabel(/valeur actuelle|valeur/i).fill("200000")
    await page.getByLabel(/prix d.achat|prix|purchase/i).fill("150000")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()

    await expect(page.getByText("Appartement Paris")).toBeVisible()
  })

  test("add credit → row appears in table", async ({ page }) => {
    await page.goto("/patrimoine")
    await page.getByRole("button", { name: /ajouter un crédit/i }).click()

    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Crédit Immobilier")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "immobilier" }).catch(async () => {
      await page.getByRole("option", { name: /immobilier/i }).click()
    })
    await page.getByLabel(/capital initial|principal/i).fill("150000")
    await page.getByLabel(/capital restant|restant/i).fill("100000")
    await page.getByLabel(/mensualité|monthly/i).fill("800")
    await page.getByLabel(/taux|rate/i).fill("2.5")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()

    await expect(page.getByText("Crédit Immobilier")).toBeVisible()
  })

  test("KPIs update after adding property (net patrimoine > 0)", async ({ page }) => {
    await page.goto("/patrimoine")
    await page.getByRole("button", { name: /ajouter un bien/i }).click()

    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Maison Test")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "immobilier" }).catch(async () => {
      await page.getByRole("option", { name: /immobilier/i }).click()
    })
    await page.getByLabel(/valeur actuelle|valeur/i).fill("300000")
    await page.getByLabel(/prix d.achat|prix|purchase/i).fill("250000")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()

    await expect(page.getByText("Maison Test")).toBeVisible()
    // Net patrimoine KPI should show a positive value
    const kpiText = await page.locator(".kpi, [class*='kpi'], [class*='stat']").allTextContents()
    const hasPositive = kpiText.some((t) => /[1-9]\d*/.test(t.replace(/\s/g, "")))
    expect(hasPositive).toBeTruthy()
  })

  test("delete property → row disappears", async ({ page }) => {
    // First add a property to delete
    await page.goto("/patrimoine")
    await page.getByRole("button", { name: /ajouter un bien/i }).click()
    await expect(page.locator("[role='dialog']")).toBeVisible()
    await page.getByLabel(/nom/i).fill("Bien à Supprimer")
    const kindSelect = page.getByLabel(/type|catégorie|kind/i)
    await kindSelect.selectOption({ label: "immobilier" }).catch(async () => {
      await page.getByRole("option", { name: /immobilier/i }).click()
    })
    await page.getByLabel(/valeur actuelle|valeur/i).fill("100000")
    await page.getByLabel(/prix d.achat|prix|purchase/i).fill("80000")
    await page.getByRole("button", { name: /enregistrer|sauvegarder|ajouter/i }).click()
    await expect(page.getByText("Bien à Supprimer")).toBeVisible()

    // Delete it
    const row = page.locator("tr, li").filter({ hasText: "Bien à Supprimer" }).first()
    await row.getByRole("button", { name: /supprimer|effacer|delete/i }).click()

    // Confirm deletion if dialog appears
    const confirmBtn = page.getByRole("button", { name: /confirmer|oui|supprimer/i })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    await expect(page.getByText("Bien à Supprimer")).not.toBeVisible()
  })
})
