import { test, expect } from "@playwright/test"

test("le contrôle d'état est public et répond 200 quand la base fonctionne", async ({ request }) => {
  const res = await request.get("/api/health")
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ status: "ok" })
})
