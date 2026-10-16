import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

test.describe("Mobile", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("menu en tiroir : ouvre, navigue, se referme", async ({ page }) => {
    const sidebar = page.locator(".sidebar")
    await expect(sidebar).not.toHaveClass(/open/)
    await page.getByRole("button", { name: /ouvrir le menu/i }).click()
    await expect(sidebar).toHaveClass(/open/)
    await sidebar.getByRole("link", { name: "Transactions" }).click()
    await expect(page).toHaveURL(/transactions/)
    await expect(sidebar).not.toHaveClass(/open/)
  })

  test("aucune page ne déborde horizontalement", async ({ page }) => {
    for (const r of ["dashboard", "transactions", "comptes", "placements", "trajectoire", "recurrent", "partage", "budget"]) {
      await page.goto("/" + r)
      await page.waitForTimeout(1500)
      const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.querySelector(".main")?.scrollWidth ?? 0))
      expect(w, `débordement sur /${r}`).toBeLessThanOrEqual(376)
    }
  })

  test("la modale d'ajout tient dans l'écran", async ({ page }) => {
    await page.goto("/transactions")
    await page.getByRole("button", { name: /ajouter une transaction/i }).click()
    const box = await page.locator(".modal").boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(376)
    await expect(page.locator(".modal").getByRole("button", { name: /enregistrer/i })).toBeVisible()
  })
})
