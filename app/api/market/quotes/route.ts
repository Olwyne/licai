import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { COINGECKO_IDS, quotesFromCoinGecko, type QuoteReq } from "@/lib/finance/market"

// GET /api/market/quotes?symbols=BTC:USD,ETH:EUR — cours crypto (CoinGecko) dans la devise de cotation de chaque ligne.
export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const raw = new URL(req.url).searchParams.get("symbols") ?? ""
  const reqs: QuoteReq[] = raw.split(",").map((s) => s.split(":")).filter(([tk]) => tk && tk.toUpperCase() in COINGECKO_IDS)
    .map(([tk, cur]) => ({ tk, cur: /^[A-Za-z]{3,5}$/.test(cur ?? "") ? cur : "USD" }))
  if (!reqs.length) return ok({})
  const ids = [...new Set(reqs.map((r) => COINGECKO_IDS[r.tk.toUpperCase()]))].join(",")
  const curs = [...new Set(reqs.map((r) => r.cur.toLowerCase()))].join(",")
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${curs}&include_24hr_change=true`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error("HTTP " + res.status)
    return ok(quotesFromCoinGecko((await res.json()) as Record<string, Record<string, number>>, reqs))
  } catch {
    return err("Fournisseur de cours injoignable.", 502)
  }
}
