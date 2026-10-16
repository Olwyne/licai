import { test, expect } from "@playwright/test"
import { createHash } from "crypto"
import Database from "better-sqlite3"
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

test.describe("Réinitialisation du mot de passe & purge", () => {
  test("lien de réinitialisation → nouveau mot de passe → connexion", async ({ page, request }) => {
    const email = `reset-${Date.now()}@example.fr`
    const created = await request.post("/api/setup", { data: { householdName: "Foyer Reset", email, password: "Ancienmdp-2026", firstName: "Re", lastName: "Set" } })
    expect(created.ok()).toBeTruthy()

    // jeton absent / invalide → refus
    const bad = await request.post("/api/auth/reset", { data: { token: "nope", password: "Nouveaumdp-2026" } })
    expect(bad.status()).toBe(400)

    // on insère un jeton connu (le vrai est seulement envoyé par e-mail) pour dérouler le parcours complet
    const token = "e2e-token-" + Date.now()
    const dbPath = (process.env.DATABASE_URL ?? "file:./data/test.db").replace("file:", "")
    const sqlite = new Database(dbPath)
    const user = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string }
    sqlite.prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
      .run("pr-" + Date.now(), user.id, createHash("sha256").update(token).digest("hex"), Math.floor(Date.now() / 1000) + 3600)
    sqlite.close()

    await page.goto(`/reset-password?token=${token}`)
    await page.locator("#pw").fill("Nouveaumdp-2026")
    await page.getByRole("button", { name: /enregistrer/i }).click()
    await expect(page.getByText(/mot de passe mis à jour/i)).toBeVisible()

    // le jeton est à usage unique
    expect((await request.post("/api/auth/reset", { data: { token, password: "Autremdp-2026" } })).status()).toBe(400)

    // ancien mot de passe refusé, nouveau accepté
    await page.goto("/login")
    await page.locator("#email").fill(email)
    await page.locator("#pw").fill("Ancienmdp-2026")
    await page.getByRole("button", { name: /se connecter/i }).click()
    await expect(page.getByText(/incorrect/i)).toBeVisible()
    await page.locator("#pw").fill("Nouveaumdp-2026")
    await page.getByRole("button", { name: /se connecter/i }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test("remise à zéro : supprime les données du foyer mais conserve le compte", async ({ page, request }) => {
    const email = `purge-${Date.now()}@example.fr`
    await request.post("/api/setup", { data: { householdName: "Foyer Purge", email, password: "Motdepasse-2026", seed: true } })
    await page.goto("/login")
    await page.locator("#email").fill(email)
    await page.locator("#pw").fill("Motdepasse-2026")
    await page.getByRole("button", { name: /se connecter/i }).click()
    await expect(page).toHaveURL(/dashboard/)
    expect(((await (await page.request.get("/api/accounts")).json()).data as unknown[]).length).toBeGreaterThan(0)
    expect((await page.request.delete("/api/reset-data")).ok()).toBeTruthy()
    expect(((await (await page.request.get("/api/accounts")).json()).data as unknown[]).length).toBe(0)
    expect(((await (await page.request.get("/api/investment-accounts")).json()).data as unknown[]).length).toBe(0)
    await page.goto("/dashboard") // le compte reste utilisable
    await expect(page).toHaveURL(/dashboard/)
  })

  test("e-mail déjà utilisé refusé à l'inscription", async ({ request }) => {
    const email = `dup-${Date.now()}@example.fr`
    const body = { householdName: "Foyer", email, password: "Motdepasse-2026" }
    expect((await request.post("/api/setup", { data: body })).ok()).toBeTruthy()
    expect((await request.post("/api/setup", { data: body })).status()).toBe(409)
  })
})
