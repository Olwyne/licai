import { test, expect } from "@playwright/test"
import { login, loginOk } from "./helpers"

test.describe.configure({ mode: "serial" })

const today = () => new Date().toISOString().slice(0, 10)

test.describe("Isolation entre foyers", () => {
  test("une opération, une modification ou un import ne peuvent pas référencer les données d'un autre foyer", async ({ page, browser, request }) => {
    // second foyer : une démonstration publique (on lit ses identifiants comme son propriétaire)
    const demo = (await (await request.post("/api/demo")).json()).data as { email: string; password: string }
    const other = await (await browser.newContext()).newPage()
    await login(other, demo.email, demo.password)
    await expect(other).toHaveURL(/dashboard/)
    const foreignAccount = (await (await other.request.get("/api/accounts")).json()).data[0].id as string
    const foreignCategory = (await (await other.request.get("/api/categories")).json()).data[0].id as string

    await loginOk(page)
    const myAccount = (await (await page.request.get("/api/accounts")).json()).data[0].id as string
    const myCategory = (await (await page.request.get("/api/categories")).json()).data[0].id as string
    const base = { name: "Isolation", amountCents: -100, date: today(), kind: "expense" }

    // création
    const badAccount = await page.request.post("/api/transactions", { data: { ...base, accountId: foreignAccount } })
    expect(badAccount.status()).toBe(400)
    expect((await badAccount.json()).error).toMatch(/compte/)
    expect((await page.request.post("/api/transactions", { data: { ...base, accountId: myAccount, categoryId: foreignCategory } })).status()).toBe(400)
    expect((await page.request.post("/api/transactions", { data: { ...base, accountId: myAccount, memberId: "inconnu" } })).status()).toBe(400)
    const ok = await page.request.post("/api/transactions", { data: { ...base, accountId: myAccount, categoryId: myCategory } })
    expect(ok.status()).toBe(201)
    const id = (await ok.json()).data.id as string

    // modification
    expect((await page.request.patch(`/api/transactions/${id}`, { data: { accountId: foreignAccount } })).status()).toBe(400)
    expect((await page.request.patch(`/api/transactions/${id}`, { data: { categoryId: foreignCategory } })).status()).toBe(400)
    expect((await page.request.patch(`/api/transactions/${id}`, { data: { note: "ok", categoryId: myCategory } })).status()).toBe(200)

    // import
    const row = { name: "Import isolation", amountCents: -500, date: today() }
    expect((await page.request.post("/api/transactions/import", { data: { accountId: foreignAccount, rows: [row] } })).status()).toBe(400)
    expect((await page.request.post("/api/transactions/import", { data: { accountId: myAccount, rows: [{ ...row, categoryId: foreignCategory }] } })).status()).toBe(400)
    expect((await page.request.post("/api/transactions/import", { data: { accountId: myAccount, ownerIds: ["inconnu"], rows: [row] } })).status()).toBe(400)
    expect((await page.request.post("/api/transactions/import", { data: { accountId: myAccount, rows: [row] } })).status()).toBe(201)

    // rien n'a fuité vers l'autre foyer
    const theirs = (await (await other.request.get("/api/transactions")).json()).data as { name: string }[]
    expect(theirs.some((t) => /Isolation|Import isolation/.test(t.name))).toBe(false)
    await page.request.delete(`/api/transactions/${id}`)
  })

  test("l'assistant d'un foyer de démonstration n'utilise pas de clé fournie par le serveur", async ({ browser, request }) => {
    const demo = (await (await request.post("/api/demo")).json()).data as { email: string; password: string }
    const other = await (await browser.newContext()).newPage()
    await login(other, demo.email, demo.password)
    await expect(other).toHaveURL(/dashboard/) // session ouverte avant d'appeler l'API
    const status = (await (await other.request.get("/api/assistant/status")).json()).data
    expect(status).toMatchObject({ builtin: false, source: "none" })
    const chat = await other.request.post("/api/assistant", { data: { messages: [{ role: "user", content: "bonjour" }] } })
    expect(chat.status()).toBe(503)
  })
})
