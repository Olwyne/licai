import { describe, expect, it } from "vitest"
import { DEFAULT_FX } from "@/lib/finance/fx"
import { cryptoRatesFromUsd, fiatRatesFromFrankfurter, isCryptoTicker, quotesFromCoinGecko } from "@/lib/finance/market"

describe("mises à jour de marché", () => {
  it("inverse les taux Frankfurter pour obtenir la contre-valeur dans la devise de référence", () => {
    const t = fiatRatesFromFrankfurter({ USD: 1.25, CHF: 0.5, BTC: 3, XXX: 2 }, "EUR", DEFAULT_FX)
    expect(t.USD).toBeCloseTo(0.8, 8)
    expect(t.CHF).toBe(2)
    expect(t.BTC).toBe(DEFAULT_FX.BTC) // crypto ignorée
    expect(t.AED).toBe(DEFAULT_FX.AED) // non couverte : conservée
  })
  it("convertit les prix crypto USD dans la devise de référence", () => {
    const t = cryptoRatesFromUsd({ bitcoin: { usd: 100000 }, ethereum: {} }, 0.9, DEFAULT_FX)
    expect(t.BTC).toBeCloseTo(90000, 6)
    expect(t.ETH).toBe(DEFAULT_FX.ETH)
  })
  it("déduit la veille de la variation 24 h", () => {
    const q = quotesFromCoinGecko({ bitcoin: { usd: 110, usd_24h_change: 10 }, ethereum: { eur: 5 } }, [
      { tk: "BTC", cur: "USD" }, { tk: "ETH", cur: "EUR" }, { tk: "SOL", cur: "USD" },
    ])
    expect(q.BTC.price).toBe(110)
    expect(q.BTC.prev).toBeCloseTo(100, 8)
    expect(q.ETH).toEqual({ price: 5, prev: null })
    expect(q.SOL).toBeUndefined()
    expect(isCryptoTicker("btc")).toBe(true)
  })
})
