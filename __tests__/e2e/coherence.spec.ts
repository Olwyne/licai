import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Cohérence entre les pages", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("le taux d'endettement est identique sur le tableau de bord et sur Crédits", async ({ page }) => {
    await page.goto("/dashboard")
    const dash = await page.locator(".metric", { hasText: "Taux d'endettement" }).locator(".metric-value").innerText()
    await page.goto("/credits")
    const cred = await page.locator(".metric", { hasText: "Taux d'endettement" }).locator(".metric-value").innerText()
    const num = (t: string) => parseFloat(t.replace(/[^\d,.-]/g, "").replace(",", "."))
    expect(num(cred)).toBeCloseTo(num(dash), 0)
  })

  test("les totaux de la page Comptes ont des libellés distincts", async ({ page }) => {
    await page.goto("/comptes")
    await expect(page.getByText("Trésorerie du foyer")).toBeVisible()
    await expect(page.getByText("Comptes + placements")).toBeVisible()
    await expect(page.getByText("Patrimoine total")).toHaveCount(0)
  })

  test("budget et transactions partagent la même pastille de période", async ({ page }) => {
    for (const r of ["/transactions", "/budget"]) {
      await page.goto(r)
      await expect(page.locator(".period-row .pill")).toHaveCount(3)
    }
  })

  test("aucune icône n'est exposée aux lecteurs d'écran", async ({ page }) => {
    await page.goto("/dashboard")
    const exposed = await page.locator("i.ti:not([aria-hidden='true'])").count()
    expect(exposed).toBe(0)
  })
})
