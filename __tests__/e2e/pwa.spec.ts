import { test, expect } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe("PWA", () => {
  test("le service worker et la page hors ligne sont publics et jamais mis en cache par le navigateur", async ({ request }) => {
    const sw = await request.get("/sw.js", { maxRedirects: 0 })
    expect(sw.status()).toBe(200)
    expect(sw.headers()["content-type"]).toMatch(/javascript/)
    expect(sw.headers()["cache-control"]).toMatch(/no-cache/)
    expect((await request.get("/offline.html", { maxRedirects: 0 })).status()).toBe(200)
    expect((await request.get("/manifest.json", { maxRedirects: 0 })).status()).toBe(200)
  })

  test("hors ligne : page de secours, et aucune donnée financière n'est stockée dans les caches", async ({ page, context }) => {
    await loginOk(page)
    await page.goto("/transactions")
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload() // la page est maintenant contrôlée par le service worker
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

    // aucune réponse d'API ni aucune page de l'app dans les caches
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname)
      return urls
    })
    expect(cached.length).toBeGreaterThan(0)
    expect(cached.filter((u) => u.startsWith("/api/") || u === "/transactions" || u === "/dashboard")).toEqual([])
    expect(cached).toContain("/offline.html")

    await context.setOffline(true)
    await page.goto("/dashboard").catch(() => {})
    await expect(page.getByRole("heading", { name: "Vous êtes hors ligne" })).toBeVisible()
    await context.setOffline(false)
  })
})
