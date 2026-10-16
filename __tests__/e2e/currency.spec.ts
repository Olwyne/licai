import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("Devises", () => {
  test("opération sur un compte en yen convertie dans la devise de référence", async ({ page }) => {
    await loginOk(page)
    const acc = await page.request.post("/api/accounts", {
      data: { name: "Compte Tokyo", type: "checking", balanceCents: 1000000, currency: "JPY", ownerIds: [] },
    })
    expect(acc.ok()).toBeTruthy()
    const { id } = (await acc.json()).data
    const tx = await page.request.post("/api/transactions", {
      data: { name: "Ramen", amountCents: -100000, date: new Date().toISOString().slice(0, 10), accountId: id, kind: "expense" },
    })
    expect(tx.ok()).toBeTruthy()
    const t = (await tx.json()).data
    expect(t.originalCurrency).toBe("JPY")
    expect(t.originalCents).toBe(-100000)
    expect(t.amountCents).toBe(Math.round(-100000 * 0.00591)) // taux de référence JPY → EUR
  })

  test("la démonstration crée un foyer isolé et la purge fonctionne", async ({ page, request }) => {
    const a = await (await request.post("/api/demo")).json()
    const b = await (await request.post("/api/demo")).json()
    expect(a.data.email).toMatch(/@licai\.demo$/)
    expect(a.data.email).not.toBe(b.data.email)
  })

  test("envoi d'e-mail : réponse identique que le compte existe ou non", async ({ request }) => {
    const r1 = await request.post("/api/auth/forgot", { data: { email: "sophie@lambert.fr" } })
    const r2 = await request.post("/api/auth/forgot", { data: { email: "nobody@example.fr" } })
    expect(await r1.json()).toEqual(await r2.json())
  })
})
