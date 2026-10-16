import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await loginOk(page)
  })

  test("transactions page loads with list", async ({ page }) => {
    await page.goto("/transactions")
    await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible()
    await expect(page.locator(".tx-item").first()).toBeVisible()
  })

  test("add transaction → appears in list", async ({ page }) => {
    await page.goto("/transactions")
    await page.getByRole("button", { name: /ajouter une transaction/i }).click()

    // Fill modal
    const modal = page.locator(".modal")
    await modal.locator(".field", { hasText: "Libellé" }).locator("input").first().fill("Test Supermarché")
    await modal.locator(".field", { hasText: "Montant" }).locator("input").first().fill("42.50")
    await modal.getByRole("button", { name: /enregistrer/i }).click()

    // Should appear in list
    await expect(page.getByText("Test Supermarché")).toBeVisible()
  })

  test("text filter narrows transaction list", async ({ page }) => {
    await page.goto("/transactions")
    const initialCount = await page.locator(".tx-item").count()

    // Type in search
    await page.locator('input[placeholder^="Rechercher une transaction"]').first().fill("Netflix")
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
    await page.locator(".tx-check").first().check()
    // Bulk bar should appear
    await expect(page.locator(".bulk-bar.on")).toBeVisible()
  })
})
