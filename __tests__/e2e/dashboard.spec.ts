import { test, expect } from "@playwright/test"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("dashboard shows KPI cards", async ({ page }) => {
    await expect(page.locator(".kpi-card")).toHaveCount(4)
    // Revenus, Dépenses, Solde, Taux d'épargne
    await expect(page.getByText(/revenus/i)).toBeVisible()
    await expect(page.getByText(/dépenses/i)).toBeVisible()
  })

  test("KPI values are non-zero for seeded data", async ({ page }) => {
    const firstKpi = page.locator(".kpi-value").first()
    await expect(firstKpi).toBeVisible()
    const text = await firstKpi.textContent()
    expect(text).not.toBe("0")
    expect(text).not.toBe("")
  })

  test("month chips allow switching period", async ({ page }) => {
    // Month chips visible
    await expect(page.locator(".chip").first()).toBeVisible()
    // Click a different month
    await page.locator(".chip").nth(1).click()
    // KPI cards still visible after switch
    await expect(page.locator(".kpi-card")).toHaveCount(4)
  })

  test("last transactions section shows rows", async ({ page }) => {
    await expect(page.locator(".last-tx-item").first()).toBeVisible()
  })
})
