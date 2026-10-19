// Mises à jour automatiques des cours : devises (BCE via Frankfurter) et crypto (CoinGecko). Fonctions pures, testables.
import { CURRENCIES, type FxTable } from "./fx"

/** Ticker → identifiant CoinGecko. */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether", USDC: "usd-coin",
  BNB: "binancecoin", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot",
  LTC: "litecoin", AVAX: "avalanche-2", LINK: "chainlink", POL: "polygon-ecosystem-token", MATIC: "polygon-ecosystem-token",
  ATOM: "cosmos", XLM: "stellar", TRX: "tron", TON: "the-open-network", SHIB: "shiba-inu",
}
export const isCryptoTicker = (tk: string): boolean => tk.toUpperCase() in COINGECKO_IDS

/**
 * Réponse Frankfurter (`/latest?base=B`) : 1 B = r X. Les taux du foyer sont l'inverse (1 X = 1/r B).
 * Les devises absentes (non couvertes par la BCE) sont laissées à `current`.
 */
export function fiatRatesFromFrankfurter(rates: Record<string, number>, base: string, current: FxTable): FxTable {
  const out: FxTable = { ...current, [base]: 1 }
  for (const [k, v] of Object.entries(rates)) {
    if (k in CURRENCIES && !CURRENCIES[k].crypto && k !== base && typeof v === "number" && v > 0 && isFinite(v)) out[k] = 1 / v
  }
  return out
}

/** Prix crypto en USD (réponse CoinGecko `simple/price?vs_currencies=usd`) → taux dans la devise de référence. */
export function cryptoRatesFromUsd(prices: Record<string, { usd?: number }>, usdInBase: number, current: FxTable): FxTable {
  const out: FxTable = { ...current }
  for (const [k, def] of Object.entries(CURRENCIES)) {
    if (!def.crypto) continue
    const usd = prices[COINGECKO_IDS[k]]?.usd
    if (typeof usd === "number" && usd > 0 && isFinite(usd)) out[k] = usd * usdInBase
  }
  return out
}

export interface QuoteReq { tk: string; cur: string }
export type QuoteRes = Record<string, { price: number; prev: number | null }>

/** Réponse CoinGecko (`vs_currencies=…&include_24hr_change=true`) → cours (et veille déduite de la variation 24 h). */
export function quotesFromCoinGecko(data: Record<string, Record<string, number>>, reqs: QuoteReq[]): QuoteRes {
  const out: QuoteRes = {}
  for (const { tk, cur } of reqs) {
    const id = COINGECKO_IDS[tk.toUpperCase()]
    const row = id ? data[id] : undefined
    const c = cur.toLowerCase()
    const price = row?.[c]
    if (typeof price !== "number" || !(price > 0)) continue
    const chg = row?.[`${c}_24h_change`]
    out[tk] = { price, prev: typeof chg === "number" && chg > -100 ? price / (1 + chg / 100) : null }
  }
  return out
}
