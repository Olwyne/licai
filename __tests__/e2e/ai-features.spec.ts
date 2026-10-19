import { test, expect, type APIRequestContext } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe.configure({ mode: "serial" })

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
const unique = () => Math.random().toString(36).slice(2, 8)

async function firstAccount(request: APIRequestContext): Promise<string> {
  const { data } = await (await request.get("/api/accounts")).json()
  return data[0].id
}
async function addTx(request: APIRequestContext, body: Record<string, unknown>) {
  const res = await request.post("/api/transactions", { data: { kind: "expense", ...body } })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data as { id: string; categoryId: string | null }
}

test.describe("Catégorisation assistée", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("une transaction sans catégorie reçoit celle du même commerçant (historique), après validation", async ({ page }) => {
    const acc = await firstAccount(page.request)
    const cat = (await (await page.request.post("/api/categories", { data: { label: `Boulangeries ${unique()}`, icon: "ti-bread", colorHex: "#D85A30" } })).json()).data
    const shop = `Boulangerie Test${unique()}`
    await addTx(page.request, { name: shop, amountCents: -420, date: iso(-20), accountId: acc, categoryId: cat.id })
    const target = await addTx(page.request, { name: `CB ${shop.toUpperCase()} 4521`, amountCents: -380, date: iso(-2), accountId: acc })
    expect(target.categoryId).toBeNull()

    await page.goto("/transactions")
    await expect(page.getByTestId("uncategorized-banner")).toBeVisible()
    await page.getByRole("button", { name: "Catégoriser", exact: true }).click()
    const row = page.locator(".q-row", { hasText: shop.toUpperCase() })
    await expect(row).toBeVisible()
    await expect(row.getByRole("combobox")).toHaveValue(cat.id)
    await expect(row).toContainText("historique")
    await page.getByRole("button", { name: /appliquer \(/i }).click()
    await expect(page.locator(".modal")).toHaveCount(0)

    const { data } = await (await page.request.get("/api/transactions")).json()
    expect(data.find((t: { id: string }) => t.id === target.id).categoryId).toBe(cat.id)
  })

  test("sans clé IA, l'assistant l'indique et seule la suggestion par historique est proposée", async ({ page }) => {
    const acc = await firstAccount(page.request)
    await addTx(page.request, { name: `Inconnu ${unique()} Boutique`, amountCents: -999, date: iso(-1), accountId: acc })
    const { data } = await (await page.request.get("/api/transactions/categorize")).json()
    expect(data.ai).toBe("unavailable")
    expect(data.total).toBeGreaterThan(0)
  })

  test("l'import CSV reprend la catégorie connue du commerçant", async ({ page }) => {
    const acc = await firstAccount(page.request)
    const cat = (await (await page.request.post("/api/categories", { data: { label: `Café ${unique()}`, icon: "ti-coffee", colorHex: "#EF9F27" } })).json()).data
    const shop = `Cafe Import${unique()}`
    await addTx(page.request, { name: shop, amountCents: -250, date: iso(-15), accountId: acc, categoryId: cat.id })
    const res = await page.request.post("/api/transactions/import", { data: { accountId: acc, rows: [{ name: `PAIEMENT CB ${shop} 77`, amountCents: -260, date: iso(-3) }, { name: `Autre ${unique()}`, amountCents: -10, date: iso(-3) }] } })
    expect((await res.json()).data).toMatchObject({ imported: 2, autoCategorized: 1 })
  })
})

test.describe("Budget suggéré", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("propose des plafonds d'après l'historique et les applique après validation", async ({ page }) => {
    const acc = await firstAccount(page.request)
    const cat = (await (await page.request.post("/api/categories", { data: { label: `Sport ${unique()}`, icon: "ti-run", colorHex: "#378ADD" } })).json()).data
    const now = new Date()
    for (const back of [1, 2, 3]) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 10).toISOString().slice(0, 10)
      await addTx(page.request, { name: `Salle ${back}`, amountCents: -20000, date: d, accountId: acc, categoryId: cat.id })
    }
    const month = now.toISOString().slice(0, 7)
    const sug = (await (await page.request.get(`/api/budget/suggestions?month=${month}`)).json()).data.items.find((i: { categoryId: string }) => i.categoryId === cat.id)
    expect(sug).toMatchObject({ months: 3, median: 200, suggested: 210, current: null })

    await page.goto("/budget")
    await page.getByRole("button", { name: /suggérer des plafonds/i }).click()
    const row = page.locator(".q-row", { hasText: cat.label })
    await expect(row).toBeVisible()
    await expect(row.getByLabel(/plafond suggéré/i)).toHaveValue("210")
    await row.getByLabel(/plafond suggéré/i).fill("225")
    await page.getByRole("button", { name: /appliquer \(/i }).click()
    await expect(page.locator(".modal")).toHaveCount(0)

    const budgets = (await (await page.request.get(`/api/budget?month=${month}`)).json()).data as { categoryId: string; limitCents: number }[]
    expect(budgets.find((b) => b.categoryId === cat.id)?.limitCents).toBe(22500)
  })
})

test.describe("Anomalies dans les alertes", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("double débit et hausse de prélèvement apparaissent dans l'onglet Anomalies", async ({ page }) => {
    const acc = await firstAccount(page.request)
    const gym = `Gymnase ${unique()}`
    await addTx(page.request, { name: gym, amountCents: -3990, date: iso(-6), accountId: acc })
    await addTx(page.request, { name: gym, amountCents: -3990, date: iso(-4), accountId: acc })
    const tel = `Opérateur ${unique()}`
    for (const [days, cents] of [[-100, -1999], [-70, -1999], [-40, -1999], [-10, -2999]] as const) await addTx(page.request, { name: tel, amountCents: cents, date: iso(days), accountId: acc })

    await page.goto("/alertes")
    await page.getByRole("button", { name: "Anomalies", exact: true }).click()
    await expect(page.getByText(`Double débit possible : ${gym}`)).toBeVisible()
    await expect(page.getByText(`Hausse de prélèvement : ${tel}`)).toBeVisible()
    await expect(page.getByText(/Passé de 19,99/)).toBeVisible()
  })
})
