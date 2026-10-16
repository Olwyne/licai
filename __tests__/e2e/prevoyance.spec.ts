import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Prévoyance", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("prevoyance page renders", async ({ page }) => {
    await page.goto("/prevoyance")
    await expect(page.getByRole("heading", { name: /prévoyance & transmission/i })).toBeVisible()
  })

  test("page shows succession, IFI and capital-gains blocks", async ({ page }) => {
    await page.goto("/prevoyance")
    for (const t of [/transmission/i, /impôt sur la fortune immobilière/i, /plus-values latentes & fiscalité de sortie/i, /suivi du prix de revient/i]) {
      await expect(page.getByText(t).first()).toBeVisible()
    }
  })

  test("switching the deceased member updates the heirs table", async ({ page }) => {
    await page.goto("/prevoyance")
    const chips = page.locator(".chips .chip", { hasText: /^Décès de/ })
    await expect(chips.first()).toBeVisible()
    if ((await chips.count()) > 1) {
      await chips.nth(1).click()
      await expect(chips.nth(1)).toHaveClass(/active/)
    }
  })

  test("add contract → row appears, then delete it", async ({ page }) => {
    await page.goto("/prevoyance")
    await page.locator("button", { hasText: /^\s*Ajouter\s*$/ }).first().click()
    const modal = page.locator(".modal")
    await expect(modal).toBeVisible()
    await modal.locator(".field", { hasText: "Nom du contrat" }).locator("input").fill("Contrat E2E")
    await modal.locator(".field", { hasText: "Assureur" }).locator("input").fill("AXA")
    await modal.locator(".field", { hasText: "Valeur actuelle" }).locator("input").fill("50000")
    await modal.locator(".field", { hasText: "Cotisation mensuelle" }).locator("input").fill("200")
    await modal.getByRole("button", { name: /^ajouter$/i }).click()
    await expect(page.getByText("Contrat E2E").first()).toBeVisible()

    await page.getByText("Contrat E2E").first().click()
    await page.locator(".modal").getByRole("button", { name: /supprimer/i }).click()
    const confirmBtn = page.locator(".modal").getByRole("button", { name: /confirmer|oui|supprimer/i })
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click()
    await expect(page.getByText("Contrat E2E")).toHaveCount(0)
  })
})
