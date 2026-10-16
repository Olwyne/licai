import { afterEach, describe, expect, it } from "vitest"
import { CURRENCIES, DEFAULT_FX, FIAT_CODES, fmtCurrency, mergeFx, rebase, setBaseCurrency } from "@/lib/finance/fx"
import { eur } from "@/lib/finance/format"
import { formatCents } from "@/lib/money"

afterEach(() => setBaseCurrency("EUR"))

describe("devise de référence", () => {
  it("rebase ramène les taux à la nouvelle devise", () => {
    const r = rebase(DEFAULT_FX, "USD")
    expect(r.USD).toBe(1)
    expect(r.EUR).toBeCloseTo(1 / DEFAULT_FX.USD, 6)
    expect(r.JPY).toBeCloseTo(DEFAULT_FX.JPY / DEFAULT_FX.USD, 8)
  })
  it("mergeFx applique les taux stockés dans la devise de référence", () => {
    const m = mergeFx({ JPY: 0.0067, USD: 99 }, "USD")
    expect(m.JPY).toBe(0.0067)
    expect(m.USD).toBe(1) // la devise de référence reste à 1
  })
  it("les crypto sont des devises mais pas des devises de référence", () => {
    expect(CURRENCIES.BTC.crypto).toBe(true)
    expect(FIAT_CODES).not.toContain("BTC")
    setBaseCurrency("BTC")
    expect(eur(1000)).toMatch(/€$/)
  })
  it("les montants s'affichent avec le symbole de la devise de référence", () => {
    setBaseCurrency("CHF")
    expect(eur(1234)).toBe("1 234 CHF")
    expect(formatCents(150000)).toBe("1 500,00 CHF")
    setBaseCurrency("USD")
    expect(eur(10)).toBe("10 $")
  })
  it("formate les cryptos avec leur précision", () => {
    expect(fmtCurrency(0.123456789, "BTC")).toBe("0,123457 ₿")
    expect(fmtCurrency(1500, "USDT")).toBe("1 500 USDT")
  })
})
