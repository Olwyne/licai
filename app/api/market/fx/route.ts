import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { mergeFx } from "@/lib/finance/fx"
import { COINGECKO_IDS, cryptoRatesFromUsd, fiatRatesFromFrankfurter } from "@/lib/finance/market"

const get = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error("HTTP " + res.status)
  return (await res.json()) as T
}

// GET /api/market/fx — taux du jour (devises : BCE via Frankfurter · crypto : CoinGecko), exprimés dans la devise de
// référence du foyer. Ne modifie rien : le client enregistre ensuite les taux via PUT /api/fx.
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  if (!hh) return err("Foyer introuvable", 404)
  const base = hh.currency
  let stored: unknown = {}
  try { stored = JSON.parse(hh.fxRates) } catch { /* taux par défaut */ }
  let rates = mergeFx(stored, base)
  const failed: string[] = []
  try {
    const j = await get<{ rates: Record<string, number> }>(`https://api.frankfurter.dev/v1/latest?base=${base}`)
    rates = fiatRatesFromFrankfurter(j.rates, base, rates)
  } catch { failed.push("devises") }
  try {
    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",")
    const j = await get<Record<string, { usd?: number }>>(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
    rates = cryptoRatesFromUsd(j, rates.USD ?? 1, rates)
  } catch { failed.push("crypto") }
  if (failed.length === 2) return err("Fournisseurs de taux injoignables.", 502)
  return ok({ rates, failed, ts: new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) })
}
