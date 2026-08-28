import { test, expect } from "@playwright/test"

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("sophie@lambert.fr")
    await page.getByLabel(/mot de passe/i).fill("demo1234")
    await page.getByRole("button", { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("transactions page loads with list", async ({ page }) => {
    await page.goto("/transactions")
    await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible()
    await expect(page.locator(".tx-item").first()).toBeVisible()
  })

  test("add transaction → appears in list", async ({ page }) => {
    await page.goto("/transactions")
    await page.getByRole("button", { name: /nouvelle opération/i }).click()

    // Fill modal
    await page.getByLabel(/nom/i).fill("Test Supermarché")
    await page.getByLabel(/montant/i).fill("42.50")
    await page.getByLabel(/date/i).fill("2026-06-15")
    await page.getByRole("button", { name: /enregistrer|sauvegarder/i }).click()

    // Should appear in list
    await expect(page.getByText("Test Supermarché")).toBeVisible()
  })

  test("text filter narrows transaction list", async ({ page }) => {
    await page.goto("/transactions")
    const initialCount = await page.locator(".tx-item").count()

    // Type in search
    await page.locator(".filter-panel input").first().fill("Netflix")
    await page.waitForTimeout(400) // debounce

    const filteredCount = await page.locator(".tx-item").count()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
    if (filteredCount > 0) {
      await expect(page.locator(".tx-item").first().getByText(/netflix/i)).toBeVisible()
    }
  })

  test("bulk categorize selected transactions", async ({ page }) => {
    await page.goto("/transactions")
    // Select first transaction checkbox
    await page.locator(".tx-check").first().click()
    // Bulk bar should appear
    await expect(page.locator(".bulk-bar.on")).toBeVisible()
  })
})
