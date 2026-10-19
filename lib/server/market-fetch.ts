import { type FxTable } from "@/lib/finance/fx"
import { COINGECKO_IDS, cryptoRatesFromUsd, fiatRatesFromFrankfurter } from "@/lib/finance/market"

const get = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error("HTTP " + res.status)
  return (await res.json()) as T
}

/** Taux du jour (devises : BCE via Frankfurter · crypto : CoinGecko) exprimés dans `base`. `failed` liste les sources injoignables. */
export async function fetchMarketRates(base: string, current: FxTable): Promise<{ rates: FxTable; failed: string[] }> {
  let rates = current
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
  return { rates, failed }
}

export const nowLabel = (): string => new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
