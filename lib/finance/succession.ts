import type { CtxMember, FinanceContext, InvKind } from "./types"
import type { PortfolioState } from "./invest"
import { INV_KINDS } from "./invest"
import type { TaxResult } from "./tax"
import { eur, pc, type Advice } from "./format"

const DIRECT: [number, number][] = [[8072, 5], [12109, 10], [15932, 15], [552324, 20], [902838, 30], [1805677, 40], [Infinity, 45]]
const IFI: [number, number][] = [[800000, 0], [1300000, 0.5], [2570000, 0.7], [5000000, 1], [10000000, 1.25], [Infinity, 1.5]]

export function scale(base: number, table: [number, number][]): { tax: number } {
  let prev = 0, t = 0
  for (const [cap, r] of table) {
    const part = Math.max(0, Math.min(base, cap) - prev)
    if (part > 0) t += (part * r) / 100
    prev = cap
    if (base <= cap) break
  }
  return { tax: t }
}

// ─── Patrimoine par personne ─────────────────────────────────────────────────

export interface PersonWealth {
  m: CtxMember
  cash: number
  placed: number
  immo: number
  debt: number
  net: number
}

const adults = (ctx: FinanceContext) => ctx.members.filter((m) => !m.isChild)

export function loanOwners(ctx: FinanceContext, loanPropertyId: string | null): string[] {
  const prop = ctx.properties.find((p) => p.id === loanPropertyId)
  const ids = prop ? Object.entries(prop.shares).filter(([, v]) => v > 0).map(([k]) => k) : []
  return ids.length ? ids : adults(ctx).map((m) => m.id)
}

export function perPerson(ctx: FinanceContext, S: PortfolioState): PersonWealth[] {
  return ctx.members.map((m) => {
    const cash = ctx.cash
      .filter((a) => a.ownerIds.includes(m.id))
      .reduce((s, a) => s + a.balance / Math.max(1, a.ownerIds.length), 0)
    const placed = ctx.invAccounts
      .filter((a) => a.ownerIds.includes(m.id))
      .reduce((s, a) => s + S.pos.filter((p) => p.acct === a.id).reduce((t, p) => t + p.value, 0) / a.ownerIds.length, 0)
    const immo = ctx.properties.reduce((s, p) => s + p.value * ((p.shares[m.id] ?? 0) / 100), 0)
    const debt = ctx.loans.reduce((s, l) => {
      const owners = loanOwners(ctx, l.propertyId)
      return owners.includes(m.id) ? s + l.left / owners.length : s
    }, 0)
    return { m, cash, placed, immo, debt, net: cash + placed + immo - debt }
  })
}

export function householdNet(ctx: FinanceContext, S: PortfolioState): number {
  const cash = ctx.cash.reduce((s, a) => s + a.balance, 0)
  const immo = ctx.properties.reduce((s, p) => s + p.value, 0)
  const debt = ctx.loans.reduce((s, l) => s + l.left, 0)
  return cash + S.total + immo - debt
}

// ─── Succession ──────────────────────────────────────────────────────────────

export interface HeirRow { m: CtxMember; share: number; gross: number; abat: number; base: number; tax: number; net: number; spouse: boolean }
export interface AvRow { m: CtxMember; gross: number; abat: number; tax: number; net: number; isSpouse: boolean }
export interface SuccessionResult {
  P: PersonWealth
  me: CtxMember
  spouse: CtxMember | undefined
  kids: CtxMember[]
  estate: number
  avTotal: number
  avRows: AvRow[]
  rows: HeirRow[]
  total: number
}

export function succession(ctx: FinanceContext, S: PortfolioState, id: string): SuccessionResult | null {
  const people = perPerson(ctx, S)
  const P = people.find((p) => p.m.id === id)
  if (!P) return null
  const me = P.m
  const spouse = ctx.members.find((m) => m.id !== id && m.incomeMonthly > 0 && !m.isChild)
  const kids = ctx.members.filter((m) => m.isChild)

  const avs = ctx.invAccounts.filter((a) => a.kind === "av" && a.ownerIds.includes(id))
  const avTotal = avs.reduce((s, a) => s + S.pos.filter((p) => p.acct === a.id).reduce((t, p) => t + p.value, 0), 0)
  const benefs = [...new Set(avs.flatMap((a) => a.benefIds))]
  const avPer = benefs.length ? avTotal / benefs.length : 0
  const avRows: AvRow[] = benefs.flatMap((b) => {
    const m = ctx.members.find((x) => x.id === b)
    if (!m) return []
    const isSpouse = !!spouse && b === spouse.id
    const taxBase = Math.max(0, avPer - 152500)
    const tax = isSpouse ? 0 : taxBase * 0.2
    return [{ m, gross: avPer, abat: Math.min(avPer, 152500), tax, net: avPer - tax, isSpouse }]
  })

  const estate = Math.max(0, P.net - avTotal)
  const heirs: { m: CtxMember; share: number; abat: number; spouse: boolean }[] = []
  if (spouse) heirs.push({ m: spouse, share: kids.length ? 0.25 : 1, abat: Infinity, spouse: true })
  const rest = spouse ? (kids.length ? 0.75 : 0) : 1
  kids.forEach((k) => heirs.push({ m: k, share: rest / (kids.length || 1), abat: 100000, spouse: false }))
  const rows: HeirRow[] = heirs.map((h) => {
    const gross = estate * h.share
    const abat = h.spouse ? gross : Math.min(gross, h.abat)
    const base = Math.max(0, gross - abat)
    const tax = h.spouse ? 0 : scale(base, DIRECT).tax
    return { ...h, gross, abat, base, tax, net: gross - tax }
  })
  return { P, me, spouse, kids, estate, avTotal, avRows, rows, total: rows.reduce((s, r) => s + r.tax, 0) + avRows.reduce((s, r) => s + r.tax, 0) }
}

export function successionAdvice(S: SuccessionResult, monthlyInvest: number): Advice[] {
  const kids = S.kids.length || 1
  const donationRoom = 100000 * kids
  const a: Advice[] = []
  const give = Math.min(donationRoom, S.estate * 0.3)
  a.push({ sev: "info", icon: "ti-gift", title: "Donation en avance de part",
    text: `Chaque parent peut donner ${eur(100000)} par enfant en franchise de droits, renouvelable tous les 15 ans — soit ${eur(donationRoom)} pour ${kids} enfant${kids > 1 ? "s" : ""} depuis ${S.me.short}.`,
    action: `Donner ${eur(give)} aujourd'hui ferait économiser environ ${eur(give * 0.2)} de droits à terme.` })
  a.push({ sev: "info", icon: "ti-cash", title: "Don familial de sommes d'argent",
    text: `En plus de l'abattement classique, ${eur(31865)} par enfant peuvent être donnés en numéraire (donateur de moins de 80 ans, enfant majeur).`,
    action: `Cumulé avec l'abattement, ${eur(131865)} par enfant et par parent sont transmissibles sans droits.` })
  const room = 152500 * Math.max(1, S.avRows.length) - S.avTotal
  a.push({ sev: room > 0 ? "good" : "mid", icon: "ti-umbrella", title: "Enveloppe d'assurance vie",
    text: room > 0
      ? `Il reste ${eur(room)} de capacité d'abattement sur les contrats avant 70 ans (${eur(152500)} par bénéficiaire).`
      : "Les abattements de 152 500 € sont saturés : au-delà, le prélèvement est de 20 % puis 31,25 % au-delà de 852 500 €.",
    action: room > 0
      ? `Les versements réalisés avant 70 ans conservent cet avantage à vie${monthlyInvest ? ` — ${eur(monthlyInvest)}/mois de versements programmés y contribuent` : ""}.`
      : "Ouvrir un contrat au nom d'un autre bénéficiaire répartit l'abattement." })
  if (S.estate > 400000) {
    const immo = S.P.immo
    a.push({ sev: "mid", icon: "ti-users", title: "Démembrement ou SCI familiale",
      text: `Avec ${eur(S.estate)} d'actif dont ${eur(immo)} d'immobilier, la donation de la nue-propriété réduit la base taxable de 30 à 60 % selon l'âge du donateur.`,
      action: "À arbitrer avec un notaire : l'économie de droits se paie en perte de souplesse." })
  }
  return a
}

// ─── IFI ─────────────────────────────────────────────────────────────────────

export interface IfiResult {
  rp: number; other: number; paper: number; debt: number
  base: number; liable: boolean; tax: number; crossYear: string
}

export function ifi(ctx: FinanceContext, S: PortfolioState): IfiResult {
  const rp = ctx.properties.filter((p) => p.type === "principale").reduce((s, p) => s + p.value, 0)
  const other = ctx.properties.filter((p) => p.type !== "principale").reduce((s, p) => s + p.value, 0)
  const paper = S.pos.filter((p) => p.cls === "immobilier").reduce((s, p) => s + p.value, 0)
  const debt = ctx.loans.filter((l) => l.kind === "immobilier" || l.kind === "travaux").reduce((s, l) => s + l.left, 0)
  const base = rp * 0.7 + other + paper - debt
  const liable = base >= 1300000
  let v = base, y = ctx.year
  while (v < 1300000 && y < 2090 && v > 0) { v *= 1.024; y++ }
  const crossYear = v <= 0 || y >= 2090 ? "au-delà de 2090" : String(y)
  return { rp, other, paper, debt, base, liable, tax: scale(base, IFI).tax, crossYear }
}

// ─── Plus-values latentes & fiscalité de sortie ──────────────────────────────

export function envTax(kind: InvKind, age: number, gain: number, tmi: number): { t: number; l: string } {
  if (kind === "pea" || kind === "peapme")
    return age >= 5 ? { t: gain * 0.172, l: "PS 17,2 % seuls — gains exonérés d'IR" } : { t: gain * 0.302, l: "Clôture avant 5 ans : 12,8 % + 17,2 %" }
  if (kind === "av")
    return age >= 8
      ? { t: Math.max(0, gain - 4600) * 0.075 + gain * 0.172, l: "Abattement 4 600 € puis 7,5 % + 17,2 %" }
      : { t: gain * 0.302, l: "Avant 8 ans : PFU 12,8 % + 17,2 %" }
  if (kind === "per") return { t: gain * 0.3, l: "Sortie en capital : 30 % sur les gains, IR sur les versements déduits" }
  if (kind === "pee")
    return age >= 5 ? { t: gain * 0.172, l: "Après 5 ans : PS 17,2 % seuls" } : { t: gain * 0.172, l: "Blocage 5 ans en cours" }
  const flat = gain * 0.3
  const bar = gain * (tmi / 100 + 0.172)
  return { t: Math.min(flat, bar), l: flat <= bar ? `Flat tax 30 % (barème : ${pc(tmi + 17.2, 1)})` : `Barème plus favorable (${pc(tmi + 17.2, 1)})` }
}

export interface PvRow {
  id: string; name: string; kindLabel: string; since: number; age: number
  value: number; gain: number; tax: number; net: number; label: string; wait: number; saving: number
}

export function pvRows(ctx: FinanceContext, S: PortfolioState, tmi: number): { rows: PvRow[]; tot: { v: number; g: number; t: number }; gainsWait: number } {
  const rows: PvRow[] = ctx.invAccounts.map((a) => {
    const pos = S.pos.filter((p) => p.acct === a.id)
    const value = pos.reduce((s, p) => s + p.value, 0)
    const gain = pos.reduce((s, p) => s + p.pv, 0)
    const age = ctx.year - a.since
    const T = envTax(a.kind, age, Math.max(0, gain), tmi)
    const wait = a.kind === "pea" || a.kind === "peapme" ? Math.max(0, 5 - age) : a.kind === "av" ? Math.max(0, 8 - age) : a.kind === "pee" ? Math.max(0, 5 - age) : 0
    const later = wait ? envTax(a.kind, 99, Math.max(0, gain), tmi).t : T.t
    return { id: a.id, name: a.name, kindLabel: INV_KINDS[a.kind].label, since: a.since, age, value, gain, tax: T.t, net: Math.max(0, value - T.t), label: T.l, wait, saving: T.t - later }
  })
  const tot = rows.reduce((a, r) => ({ v: a.v + r.value, g: a.g + r.gain, t: a.t + r.tax }), { v: 0, g: 0, t: 0 })
  const gainsWait = rows.reduce((s, r) => s + Math.max(0, r.saving), 0)
  return { rows, tot, gainsWait }
}

// ─── Prélèvements sociaux & acomptes ─────────────────────────────────────────

export interface PsLine { label: string; value: string; hint: string; cls?: string }

export function psLines(T: TaxResult, pvLatent: number): PsLine[] {
  const pasMonthly = (T.irNet * 0.91) / 12
  const acompteFoncier = (T.foncier > 0 ? T.foncier * (T.pasRate / 100) : 0) / 12
  return [
    { label: "PS sur revenus fonciers", value: eur(T.psFoncier), hint: `17,2 % sur ${eur(Math.max(0, T.foncier))} de revenu net foncier` },
    { label: "PS sur revenus de capitaux", value: eur(T.psCapitaux), hint: `Dividendes et intérêts déclarés · ${eur(T.s.dividendes + T.s.interets)}` },
    { label: "PS latents sur les placements", value: eur(pvLatent * 0.172), hint: "Dus seulement à la sortie, hors PEA après 5 ans" },
    { label: "Retenue à la source sur salaires", value: eur(pasMonthly), hint: "Prélevée chaque mois par l'employeur" },
    { label: "Acompte mensuel sur le foncier", value: eur(acompteFoncier), hint: "Prélevé le 15 de chaque mois sur le compte déclaré" },
    { label: "Total des prélèvements de l'année", value: eur(T.totalPrel), hint: `${pc(T.tauxGlobal, 1)} des revenus réels du foyer`, cls: "neg" },
  ]
}
