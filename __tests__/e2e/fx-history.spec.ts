import { test, expect } from "@playwright/test"
import Database from "better-sqlite3"
import { loginOk } from "./helpers"

test.describe.configure({ mode: "serial" })

const dbPath = (process.env.DATABASE_URL ?? "file:./data/test.db").replace("file:", "")

test.describe("Historique des taux et écart de change", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("une opération antérieure est convertie au taux de sa date", async ({ page }) => {
    const acc = (await (await page.request.post("/api/accounts", { data: { name: "Yen historique", type: "checking", balanceCents: 5_000_000, currency: "JPY", ownerIds: [] } })).json()).data
    const sqlite = new Database(dbPath)
    const hh = sqlite.prepare("SELECT household_id AS id FROM accounts WHERE id = ?").get(acc.id) as { id: string }
    sqlite.prepare("INSERT OR REPLACE INTO fx_history (household_id, date, base, rates) VALUES (?, ?, 'EUR', ?)").run(hh.id, "2026-01-01", JSON.stringify({ JPY: 0.005, EUR: 1 }))
    sqlite.close()

    const old = (await (await page.request.post("/api/transactions", { data: { name: "Ancien ramen", amountCents: -100000, date: "2026-01-15", accountId: acc.id, kind: "expense" } })).json()).data
    expect(old.amountCents).toBe(Math.round(-100000 * 0.005)) // taux du relevé du 1er janvier
    const recent = (await (await page.request.post("/api/transactions", { data: { name: "Ramen du jour", amountCents: -100000, date: new Date().toISOString().slice(0, 10), accountId: acc.id, kind: "expense" } })).json()).data
    expect(recent.amountCents).toBe(Math.round(-100000 * 0.00591)) // taux courant

    // changer la date d'une opération la reconvertit au taux de la nouvelle date
    const moved = (await (await page.request.patch(`/api/transactions/${recent.id}`, { data: { date: "2026-01-20" } })).json()).data
    expect(moved.amountCents).toBe(Math.round(-100000 * 0.005))
    expect(moved.originalCents).toBe(-100000)
  })

  test("l'écart de change s'affiche quand le taux évolue depuis l'ouverture du compte", async ({ page }) => {
    const created = (await (await page.request.post("/api/accounts", { data: { name: "Yen écart", type: "checking", balanceCents: 10_000_000, currency: "JPY", ownerIds: [] } })).json()).data
    expect(created.openedRate).toBeCloseTo(0.00591, 6)

    const put = await page.request.put("/api/fx", { data: { rates: { JPY: 0.0066 }, source: "manual", ts: "test" } })
    expect(put.ok()).toBeTruthy()

    await page.goto("/comptes")
    const card = page.locator(".acct-card", { hasText: "Yen écart" })
    await expect(card.getByTestId("fx-gain")).toContainText("Écart de change : +")
    await expect(page.getByText("Écart de change latent")).toBeVisible()

    // retour aux taux de référence pour les autres tests
    await page.request.put("/api/fx", { data: { rates: { JPY: 0.00591 }, source: "demo", ts: "taux de référence (démonstration)" } })
  })

  test("la mise à jour automatique se règle dans la fenêtre des taux et n'agit que si elle est activée", async ({ page }) => {
    // désactivée par défaut : le serveur ne rafraîchit rien
    const off = await (await page.request.post("/api/market/fx/refresh")).json()
    expect(off.data).toEqual({ refreshed: false, reason: "disabled" })

    await page.goto("/comptes")
    await page.getByRole("button", { name: /taux & devises/i }).click()
    await page.getByRole("switch", { name: /mise à jour automatique des taux/i }).check()
    await page.getByRole("button", { name: /appliquer/i }).click()
    await expect(page.locator(".modal")).toHaveCount(0)

    // activée et fraîche (on vient d'enregistrer les taux) : pas de nouvel appel externe
    const fresh = await (await page.request.post("/api/market/fx/refresh")).json()
    expect(fresh.data).toEqual({ refreshed: false, reason: "fresh" })
    await page.request.put("/api/fx", { data: { rates: { JPY: 0.00591 }, source: "demo", ts: "taux de référence (démonstration)", auto: false } })
  })
})
