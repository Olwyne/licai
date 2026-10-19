import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

const KEY = "sk-ant-test-0123456789abcdef"

test.describe("Assistant IA", () => {
  test.describe.configure({ mode: "serial" })
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("sans clé API : ni bouton dans le menu, ni bulle", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.locator(".sidebar").getByText("Assistant IA")).toHaveCount(0)
    await page.waitForTimeout(800) // statut serveur chargé
    await expect(page.locator(".chat-fab")).toHaveCount(0)
  })

  test("la clé se saisit dans Paramètres, se masque/affiche, fait apparaître la bulle, puis se supprime", async ({ page }) => {
    await page.goto("/parametres")
    const input = page.locator("#ai-key")
    await expect(input).toHaveAttribute("type", "password")
    await input.fill(KEY)
    await page.getByRole("button", { name: /afficher la clé/i }).click()
    await expect(input).toHaveAttribute("type", "text")
    await page.getByRole("button", { name: /masquer la clé/i }).click()
    await expect(input).toHaveAttribute("type", "password")
    await page.getByRole("button", { name: /enregistrer la clé/i }).click()
    await expect(page.getByText("Clé enregistrée.")).toBeVisible()

    // persistée : la valeur n'est pas dans le champ, l'œil la relit côté serveur
    await page.reload()
    await expect(page.locator("#ai-key")).toHaveValue("")
    await expect(page.locator("#ai-key")).toHaveAttribute("placeholder", /cdef/)
    await page.getByRole("button", { name: /afficher la clé/i }).click()
    await expect(page.locator("#ai-key")).toHaveValue(KEY)

    // la bulle apparaît partout dans l'app
    await page.goto("/dashboard")
    await expect(page.locator(".chat-fab")).toBeVisible()

    await page.goto("/parametres")
    await page.locator(".card", { hasText: "Assistant financier IA" }).getByRole("button", { name: /supprimer la clé/i }).click()
    await expect(page.getByText("Clé supprimée.")).toBeVisible()
    await page.goto("/dashboard")
    await expect(page.locator(".chat-fab")).toHaveCount(0)
  })

  test("le fournisseur et le modèle se choisissent dans Paramètres (modèle automatique par défaut)", async ({ page }) => {
    await page.goto("/parametres")
    await expect(page.locator("#ai-provider option")).toHaveText(["Claude (Anthropic)", "ChatGPT (OpenAI)", "Gemini (Google)"])
    await expect(page.locator("#ai-model option").first()).toContainText("Automatique")
    await page.locator("#ai-provider").selectOption("gemini")
    await expect(page.locator("#ai-key")).toHaveAttribute("placeholder", "AIza…")
    await page.locator("#ai-key").fill("AIzaSy-test-0123456789abcdef")
    await page.getByRole("button", { name: /enregistrer la clé/i }).click()
    await expect(page.getByText("Clé enregistrée.")).toBeVisible()
    const status = await (await page.request.get("/api/assistant/status")).json()
    expect(status.data).toMatchObject({ provider: "gemini", chosenModel: "", source: "account" })
    await page.request.put("/api/assistant/key", { data: { provider: "anthropic", key: "" } })
  })

  test("un nom de modèle invalide ou une clé trop courte est refusée par le serveur", async ({ page }) => {
    const res = await page.request.put("/api/assistant/key", { data: { key: "abc" } })
    expect(res.status()).toBe(400)
    const bad = await page.request.put("/api/assistant/key", { data: { model: "un modèle" } })
    expect(bad.status()).toBe(400)
  })

  test("la clé n'est jamais renvoyée par le statut", async ({ page }) => {
    await page.request.put("/api/assistant/key", { data: { key: KEY } })
    const status = await (await page.request.get("/api/assistant/status")).json()
    expect(JSON.stringify(status)).not.toContain(KEY)
    expect(status.data).toMatchObject({ builtin: true, source: "account", hint: "…cdef" })
    await page.request.put("/api/assistant/key", { data: { key: "" } })
  })
})
