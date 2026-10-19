// Devises et taux de change. Les taux du foyer (households.fx_rates) sont exprimés dans la devise de référence du foyer :
// 1 unité de devise = X unités de la devise de référence. DEFAULT_FX / CURRENCIES.rate sont des taux de référence en euro.

export interface CurrencyDef { name: string; sym: string; rate: number; crypto?: boolean; dec?: number }

export const CURRENCIES: Record<string, CurrencyDef> = {
  EUR: { name: "Euro", sym: "€", rate: 1 },
  USD: { name: "Dollar US", sym: "$", rate: 0.882 },
  GBP: { name: "Livre sterling", sym: "£", rate: 1.174 },
  CHF: { name: "Franc suisse", sym: "CHF", rate: 1.062 },
  JPY: { name: "Yen japonais", sym: "¥", rate: 0.00591, dec: 0 },
  CAD: { name: "Dollar canadien", sym: "C$", rate: 0.646 },
  AUD: { name: "Dollar australien", sym: "A$", rate: 0.578 },
  NZD: { name: "Dollar néo-zélandais", sym: "NZ$", rate: 0.531 },
  SEK: { name: "Couronne suédoise", sym: "kr", rate: 0.0873 },
  NOK: { name: "Couronne norvégienne", sym: "kr", rate: 0.0851 },
  DKK: { name: "Couronne danoise", sym: "kr", rate: 0.1341 },
  PLN: { name: "Zloty polonais", sym: "zł", rate: 0.2334 },
  CZK: { name: "Couronne tchèque", sym: "Kč", rate: 0.0402 },
  HUF: { name: "Forint hongrois", sym: "Ft", rate: 0.00251, dec: 0 },
  RON: { name: "Leu roumain", sym: "lei", rate: 0.2011 },
  CNY: { name: "Yuan chinois", sym: "¥", rate: 0.1237 },
  HKD: { name: "Dollar de Hong Kong", sym: "HK$", rate: 0.1131 },
  SGD: { name: "Dollar de Singapour", sym: "S$", rate: 0.6702 },
  KRW: { name: "Won coréen", sym: "₩", rate: 0.000651, dec: 0 },
  INR: { name: "Roupie indienne", sym: "₹", rate: 0.0104 },
  BRL: { name: "Réal brésilien", sym: "R$", rate: 0.1548 },
  MXN: { name: "Peso mexicain", sym: "MX$", rate: 0.0472 },
  ZAR: { name: "Rand sud-africain", sym: "R", rate: 0.0491 },
  TRY: { name: "Livre turque", sym: "₺", rate: 0.0224 },
  AED: { name: "Dirham des Émirats", sym: "AED", rate: 0.2401 },
  MAD: { name: "Dirham marocain", sym: "MAD", rate: 0.0921 },
  TND: { name: "Dinar tunisien", sym: "DT", rate: 0.2887 },
  XOF: { name: "Franc CFA (BCEAO)", sym: "F CFA", rate: 0.001524, dec: 0 },
  BTC: { name: "Bitcoin", sym: "₿", rate: 58000, crypto: true, dec: 6 },
  ETH: { name: "Ethereum", sym: "Ξ", rate: 2300, crypto: true, dec: 5 },
  SOL: { name: "Solana", sym: "SOL", rate: 130, crypto: true, dec: 4 },
  USDT: { name: "Tether", sym: "USDT", rate: 0.88, crypto: true, dec: 2 },
  USDC: { name: "USD Coin", sym: "USDC", rate: 0.88, crypto: true, dec: 2 },
}

/** Devise de référence du foyer (affichage des montants). Renseignée au chargement de l'app. */
let baseCurrency = "EUR"
export const setBaseCurrency = (cur: string): void => { if (cur in CURRENCIES && !CURRENCIES[cur].crypto) baseCurrency = cur }
export const getBaseCurrency = (): string => baseCurrency
export const baseSym = (): string => CURRENCIES[baseCurrency]?.sym ?? baseCurrency
/** Devises utilisables comme devise de référence (hors crypto). */
export const FIAT_CODES = Object.keys(CURRENCIES).filter((k) => !CURRENCIES[k].crypto)

export type FxTable = Record<string, number>
export type FxSource = "demo" | "manual" | "api"

export const DEFAULT_FX: FxTable = Object.fromEntries(Object.entries(CURRENCIES).map(([k, v]) => [k, v.rate]))

/** Change la devise de référence d'une table de taux : 1 unité = X unités de `base`. */
export function rebase(table: FxTable, base: string): FxTable {
  const d = table[base] || 1
  return Object.fromEntries(Object.keys(CURRENCIES).map((k) => [k, k === base ? 1 : (table[k] ?? DEFAULT_FX[k]) / d]))
}

/** Taux stockés (valeurs valides uniquement, exprimés dans `base`) fusionnés avec les taux de référence ramenés à `base`. */
export function mergeFx(stored: unknown, base = "EUR"): FxTable {
  const out = rebase(DEFAULT_FX, base)
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      if (k in CURRENCIES && k !== base && typeof v === "number" && v > 0 && isFinite(v)) out[k] = v
    }
  }
  return out
}

export const fxRate = (cur: string, table: FxTable = DEFAULT_FX): number => table[cur] ?? 1
export const currencySym = (cur: string): string => CURRENCIES[cur]?.sym ?? cur

export function fmtCurrency(amount: number, cur = baseCurrency): string {
  const v = Math.abs(amount)
  const dec = CURRENCIES[cur]?.dec
  const n = dec != null
    ? v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: dec })
    : Number.isInteger(v) ? v.toLocaleString("fr-FR") : v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sym = cur === "EUR" ? "€" : currencySym(cur)
  return `${n} ${sym}`.replace(/[\u202f\u00a0]/g, " ")
}

export interface ExposureRow { cur: string; eur: number; nat: number; w: number }

/** Exposition par devise : comptes (solde natif) + placements (valeur déjà en euro). */
export function exposure(
  accounts: { balance: number; native: number; cur: string }[],
  positions: { value: number; qty: number; price: number; cur: string }[],
): { rows: ExposureRow[]; total: number; cash: number } {
  const m: Record<string, ExposureRow> = {}
  const push = (cur: string, eur: number, nat: number) => {
    m[cur] = m[cur] ?? { cur, eur: 0, nat: 0, w: 0 }
    m[cur].eur += eur; m[cur].nat += nat
  }
  accounts.forEach((a) => push(a.cur, a.balance, a.native))
  positions.forEach((p) => push(p.cur, p.value, p.qty * p.price))
  const rows = Object.values(m).sort((a, b) => b.eur - a.eur)
  const total = rows.reduce((s, r) => s + r.eur, 0)
  const cash = accounts.reduce((s, a) => s + a.balance, 0)
  rows.forEach((r) => (r.w = total ? (r.eur / total) * 100 : 0))
  return { rows, total, cash }
}
