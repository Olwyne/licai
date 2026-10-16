// Amortissement d'un prêt, remboursement anticipé, placement alternatif — montants en euros.

export interface AmortRow { n: number; int: number; cap: number; left: number }

export function schedule(capital: number, annualRate: number, monthly: number): AmortRow[] {
  const r = annualRate / 100 / 12
  const rows: AmortRow[] = []
  let left = capital
  for (let i = 1; i <= 600 && left > 0.5; i++) {
    const int = left * r
    let cap = monthly - int
    if (cap <= 0) break
    if (cap > left) cap = left
    left -= cap
    rows.push({ n: i, int, cap, left })
  }
  return rows
}

export function pmt(capital: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12
  if (!r) return months ? capital / months : 0
  return (capital * r) / (1 - Math.pow(1 + r, -months))
}

export function grow(capital: number, monthly: number, years: number, annualPct: number): number {
  const r = Math.pow(1 + annualPct / 100, 1 / 12) - 1
  let v = capital
  for (let i = 0; i < Math.round(years * 12); i++) v = v * (1 + r) + monthly
  return v
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
export const monthLabel = (ym: string): string => { const [y, m] = ym.split("-"); return `${MONTHS[Number(m) - 1]} ${y}` }

export interface YearRow { year: string; n: number; cap: number; int: number; left: number }

export function byYear(rows: AmortRow[], startYm: string): YearRow[] {
  const out: Record<string, YearRow> = {}
  rows.forEach((r, i) => {
    const y = addMonths(startYm, i + 1).split("-")[0]
    out[y] = out[y] ?? { year: y, n: 0, cap: 0, int: 0, left: 0 }
    out[y].cap += r.cap; out[y].int += r.int; out[y].left = r.left; out[y].n++
  })
  return Object.values(out)
}

export type EarlyMode = "duree" | "mensualite"

export interface EarlyResult {
  amount: number; newLeft: number; months: number; newMonths: number; newMonthly: number
  interest: number; saved: number; ira: number; gain: number; altGain: number; implicitPct: number
}

export function earlyRepayment(loan: { left: number; rate: number; monthly: number }, amountIn: number, mode: EarlyMode, altRate: number): EarlyResult {
  const base = schedule(loan.left, loan.rate, loan.monthly)
  const interest = base.reduce((s, r) => s + r.int, 0)
  const amount = Math.min(Math.max(0, amountIn), loan.left)
  const newLeft = loan.left - amount
  const alt = mode === "duree" ? schedule(newLeft, loan.rate, loan.monthly) : null
  const newMonthly = mode === "mensualite" ? pmt(newLeft, loan.rate, base.length) : loan.monthly
  const altInt = alt ? alt.reduce((s, r) => s + r.int, 0) : schedule(newLeft, loan.rate, newMonthly).reduce((s, r) => s + r.int, 0)
  const saved = interest - altInt
  // indemnité : le plus faible de 3 % du capital remboursé et 6 mois d'intérêts
  const ira = Math.min(amount * 0.03, ((loan.left * loan.rate) / 100) / 2)
  const gain = saved - ira
  const newMonths = alt ? alt.length : base.length
  return {
    amount, newLeft, months: base.length, newMonths, newMonthly, interest, saved, ira, gain,
    altGain: grow(amount, 0, base.length / 12, altRate) - amount,
    implicitPct: amount ? (gain / amount) * 100 : 0,
  }
}
