import type { AssetClass, CtxHolding, CtxInvAccount, CtxMember, FinanceContext, InvKind } from "./types"
import { eur, eurS, pc, pcS, type Advice } from "./format"

import { fxRate, getBaseCurrency, type FxTable, DEFAULT_FX } from "./fx"
export { fxRate }

export interface KindDef {
  label: string; short: string; icon: string; color: string
  ceiling: number | null; fisc: string; tax: string
}

export const INV_KINDS: Record<InvKind, KindDef> = {
  av:     { label: "Assurance vie",     short: "AV",      icon: "ti-umbrella",         color: "#1D9E75", ceiling: null,   fisc: "Retraits libres · abattement 4 600 €/an après 8 ans", tax: "PS 17,2 % + IR/PFU 7,5 %" },
  pea:    { label: "PEA",               short: "PEA",     icon: "ti-chart-candle",     color: "#378ADD", ceiling: 150000, fisc: "Gains exonérés d'IR après 5 ans",                     tax: "PS 17,2 % uniquement" },
  peapme: { label: "PEA-PME",           short: "PEA-PME", icon: "ti-building-store",   color: "#7C6BD6", ceiling: 225000, fisc: "Même régime que le PEA · plafond cumulé 225 000 €",   tax: "PS 17,2 % uniquement" },
  cto:    { label: "Compte-titres",     short: "CTO",     icon: "ti-briefcase",        color: "#EF9F27", ceiling: null,   fisc: "Aucun blocage · imposition à la cession",              tax: "Flat tax 30 %" },
  per:    { label: "PER",               short: "PER",     icon: "ti-parachute",        color: "#D4537E", ceiling: null,   fisc: "Versements déductibles · bloqué jusqu'à la retraite",  tax: "IR à la sortie sur le capital versé" },
  pee:    { label: "Épargne salariale", short: "PEE",     icon: "ti-users-group",      color: "#888780", ceiling: null,   fisc: "Blocage 5 ans · abondement employeur",                 tax: "PS 17,2 % sur les gains" },
  crypto: { label: "Crypto",            short: "Crypto",  icon: "ti-currency-bitcoin", color: "#D85A30", ceiling: null,   fisc: "Cession imposable · déclaration annexe 2086",          tax: "Flat tax 30 %" },
  livret: { label: "Livrets",           short: "Livrets", icon: "ti-pig-money",        color: "#1D9E75", ceiling: null,   fisc: "Capital garanti · disponible immédiatement",           tax: "Exonéré (LA/LDDS)" },
}

export const ASSETS: Record<AssetClass, { label: string; color: string }> = {
  actions:     { label: "Actions",     color: "#1D9E75" },
  obligations: { label: "Obligations", color: "#378ADD" },
  euro:        { label: "Fonds euro",  color: "#888780" },
  immobilier:  { label: "Immobilier",  color: "#EF9F27" },
  monetaire:   { label: "Monétaire",   color: "#7C6BD6" },
  crypto:      { label: "Crypto",      color: "#D85A30" },
}

export type ProfileKey = "prudent" | "equilibre" | "dynamique"
export const PROFILES: Record<ProfileKey, { label: string; target: Record<AssetClass, number> }> = {
  prudent:   { label: "Prudent",   target: { actions: 30, obligations: 25, euro: 30, immobilier: 10, monetaire: 5, crypto: 0 } },
  equilibre: { label: "Équilibré", target: { actions: 55, obligations: 15, euro: 15, immobilier: 10, monetaire: 3, crypto: 2 } },
  dynamique: { label: "Dynamique", target: { actions: 75, obligations: 5,  euro: 5,  immobilier: 8,  monetaire: 2, crypto: 5 } },
}

export const ZONES = ["Monde", "États-Unis", "Europe", "Zone euro", "France", "Émergents", "Asie"]
export const CURRENCIES_LIST = ["EUR", "USD", "GBP", "CHF"]

export type QuoteOverrides = Record<string, { price: number; prev?: number | null }>

export interface Position extends CtxHolding {
  value: number
  pv: number
  pvPct: number
  day: number
  dayEur: number
  w: number
  quoteSrc: string
}

export interface GroupRow { k: string; v: number; w: number }

export interface PortfolioState {
  pos: Position[]
  total: number
  pv: number
  dayEur: number
  paid: number
  monthly: number
  match: number
  ter: number
  fees: number
  tri: number
  years: number
  cls: GroupRow[]
  target: Record<AssetClass, number>
  profile: ProfileKey
}

export function group(list: Position[], key: keyof Position | ((p: Position) => string)): GroupRow[] {
  const total = list.reduce((s, p) => s + p.value, 0)
  const m: Record<string, number> = {}
  list.forEach((p) => {
    const k = String(typeof key === "function" ? key(p) : p[key])
    m[k] = (m[k] ?? 0) + p.value
  })
  return Object.entries(m)
    .map(([k, v]) => ({ k, v, w: total ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.v - a.v)
}

export const byAcct = (pos: Position[], id: string): number =>
  pos.filter((p) => p.acct === id).reduce((s, p) => s + p.value, 0)

export function computePositions(holdings: CtxHolding[], quotes: QuoteOverrides = {}, fx: FxTable = DEFAULT_FX): Position[] {
  const list = holdings.map((h) => {
    const ov = quotes[h.tk]
    const price = ov ? ov.price : h.price
    const prev = ov ? (ov.prev ?? h.prev) : h.prev
    const fxr = fxRate(h.cur, fx)
    const value = h.qty * price * fxr
    const pv = h.gain != null ? h.gain : value - h.qty * h.pru * fxr
    const day = prev ? (price - prev) / prev : 0
    return {
      ...h, price, prev, value, pv,
      pvPct: value - pv ? (pv / (value - pv)) * 100 : 0,
      day, dayEur: (value * day) / (1 + day), w: 0,
      quoteSrc: ov ? "manuel" : "démo",
    } as Position
  })
  const total = list.reduce((s, p) => s + p.value, 0)
  list.forEach((p) => (p.w = total ? (p.value / total) * 100 : 0))
  return list.sort((a, b) => b.value - a.value)
}

export function computePortfolio(
  ctx: Pick<FinanceContext, "holdings" | "invAccounts" | "year"> & { fx?: FxTable },
  profile: ProfileKey,
  quotes: QuoteOverrides = {},
): PortfolioState {
  const pos = computePositions(ctx.holdings, quotes, ctx.fx)
  const accts = ctx.invAccounts
  const total = pos.reduce((s, p) => s + p.value, 0)
  const pv = pos.reduce((s, p) => s + p.pv, 0)
  const dayEur = pos.reduce((s, p) => s + p.dayEur, 0)
  const paid = accts.reduce((s, a) => s + a.paid, 0)
  const monthly = accts.reduce((s, a) => s + a.monthly, 0)
  const match = accts.reduce((s, a) => s + (a.match ? (a.monthly * a.match) / 100 : 0), 0)
  const ter = total ? pos.reduce((s, p) => s + p.ter * p.value, 0) / total : 0
  const fees =
    pos.reduce((s, p) => s + (p.ter / 100) * p.value, 0) +
    accts.reduce((s, a) => s + (a.fees / 100) * byAcct(pos, a.id), 0)
  const years = paid ? accts.reduce((s, a) => s + a.paid * Math.max(0, ctx.year - a.since), 0) / paid : 0
  const tri = paid > 0 && years > 0 && total > 0 ? (Math.pow(total / paid, 1 / years) - 1) * 100 : 0
  return { pos, total, pv, dayEur, paid, monthly, match, ter, fees, tri, years, cls: group(pos, "cls"), target: PROFILES[profile].target, profile }
}

export const usedCeiling = (accts: CtxInvAccount[], kind: "pea" | "peapme"): number =>
  accts.filter((a) => a.kind === kind).reduce((s, a) => s + a.paid, 0)

// ─── Allocation vs cible ─────────────────────────────────────────────────────

export interface AllocRow { k: AssetClass; cur: number; tgt: number; gap: number; money: number }

export function allocationRows(S: PortfolioState): AllocRow[] {
  return (Object.keys(S.target) as AssetClass[])
    .map((k) => {
      const cur = S.cls.find((c) => c.k === k)?.w ?? 0
      const tgt = S.target[k]
      const gap = cur - tgt
      return { k, cur, tgt, gap, money: (gap / 100) * S.total }
    })
    .sort((a, b) => b.cur - a.cur)
}

// ─── Conseils & rééquilibrage ────────────────────────────────────────────────

export function investAdvice(S: PortfolioState, ctx: FinanceContext): Advice[] {
  const { pos } = S
  const w = (k: string) => S.cls.find((c) => c.k === k)?.w ?? 0
  const zones = group(pos, "zone")
  const sectors = group(pos, "sector")
  const curs = group(pos, "cur")
  const envs = group(pos, (p) => INV_KINDS[ctx.invAccounts.find((a) => a.id === p.acct)?.kind ?? "cto"].label)
  const zw = (name: string) => zones.find((z) => z.k === name)?.w ?? 0
  const top3 = pos.slice(0, 3).reduce((s, p) => s + p.w, 0)
  const hhi = pos.reduce((s, p) => s + p.w ** 2, 0)
  const nonEur = curs.filter((c) => c.k !== getBaseCurrency()).reduce((s, c) => s + c.w, 0)
  const cher = pos.filter((p) => p.ter >= 1).sort((a, b) => b.ter * b.value - a.ter * a.value)
  const peaLeft = 150000 - usedCeiling(ctx.invAccounts, "pea")
  const spend = ctx.monthlySpend || 1
  const profileLabel = PROFILES[S.profile].label.toLowerCase()
  const A: Advice[] = []
  const push = (sev: Advice["sev"], icon: string, title: string, text: string, action: string) => A.push({ sev, icon, title, text, action })

  if (!pos.length) return A

  const gaps = (Object.keys(S.target) as AssetClass[])
    .map((k) => ({ k, gap: w(k) - S.target[k], money: ((w(k) - S.target[k]) / 100) * S.total }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  gaps.filter((g) => Math.abs(g.gap) >= 5).forEach((g) => {
    const lab = ASSETS[g.k].label
    if (g.gap > 0)
      push("mid", "ti-arrows-down-up", `${lab} au-dessus de la cible (${pc(w(g.k), 0)} vs ${S.target[g.k]} %)`,
        `Écart de ${pcS(g.gap, 0)} pour un profil ${profileLabel}.`,
        `Alléger ${eur(Math.abs(g.money))} — ou n'y verser plus rien et laisser les versements programmés diluer la ligne.`)
    else
      push("mid", "ti-arrows-down-up", `${lab} sous la cible (${pc(w(g.k), 0)} vs ${S.target[g.k]} %)`,
        `Il manque ${eur(Math.abs(g.money))} sur cette classe d'actifs.`,
        S.monthly > 0
          ? `Orienter les prochains versements (${eur(S.monthly)}/mois) vers ${lab.toLowerCase()} pendant ${Math.max(1, Math.round(Math.abs(g.money) / S.monthly))} mois.`
          : `Orienter les prochains versements vers ${lab.toLowerCase()}.`)
  })
  if (top3 > 40)
    push("high", "ti-target-arrow", `Concentration : ${pc(top3, 0)} sur 3 lignes`,
      `${pos.slice(0, 3).map((p) => `${p.name} ${pc(p.w, 0)}`).join(", ")}. Indice de concentration ${Math.round(hhi)} (au-delà de 1 500, portefeuille peu diversifié).`,
      `Plafonner chaque ligne à 25 % : ${eur(((top3 - 40) / 100) * S.total)} à redéployer sur des lignes existantes.`)
  if (zw("Émergents") < 5)
    push("mid", "ti-world", `Marchés émergents quasi absents (${pc(zw("Émergents"), 1)})`,
      "Une poche de 5 à 10 % est l'usage pour capter la croissance hors pays développés.",
      `Renforcer l'ETF émergents du PEA de ${eur((0.07 - zw("Émergents") / 100) * S.total)} pour viser 7 %.`)
  if (zw("France") + zw("Europe") > 30)
    push("mid", "ti-flag", `Biais domestique : ${pc(zw("France") + zw("Europe"), 0)} en France et Europe`,
      "La France pèse moins de 3 % de la capitalisation mondiale : la surpondération est un pari, pas une diversification.",
      `Basculer progressivement vers un ETF Monde ou États-Unis (${eur(((zw("France") + zw("Europe") - 25) / 100) * S.total)} au-delà de 25 %).`)
  const tech = sectors.find((s) => s.k === "Technologie")?.w ?? 0
  if (tech > 20)
    push("mid", "ti-cpu", `Technologie à ${pc(tech, 0)} du portefeuille`,
      "Les ETF Monde et S&P 500 contiennent déjà ~30 % de technologie : les lignes en direct s'ajoutent à cette exposition.",
      "Considérer les titres tech en direct du CTO comme du renforcement sectoriel, pas de la diversification.")
  if (nonEur > 25)
    push("info", "ti-currency-dollar", `${pc(nonEur, 0)} du portefeuille libellé hors euro`,
      "Le risque de change n'est pas couvert : il amplifie les mouvements dans les deux sens.",
      "Acceptable sur un horizon long ; à surveiller si un projet à moins de 3 ans dépend de ces sommes.")
  if (cher.length)
    push("mid", "ti-receipt-tax", `${cher.length} ligne${cher.length > 1 ? "s" : ""} à frais élevés (TER ≥ 1 %)`,
      cher.map((p) => `${p.name} ${pc(p.ter, 2)} → ${eur((p.ter / 100) * p.value)}/an`).join(" · "),
      `Un ETF indiciel équivalent coûte 0,20 % : ${eur(cher.reduce((s, p) => s + ((p.ter - 0.2) / 100) * p.value, 0))} d'économie annuelle possible.`)
  if (w("euro") > S.target.euro + 3)
    push("info", "ti-shield", `Fonds euro à ${pc(w("euro"), 0)}`,
      "Capital garanti mais rendement proche de l'inflation.",
      "Sur un horizon > 8 ans, arbitrer une partie vers des unités de compte actions relèverait le rendement espéré.")
  if (peaLeft > 0) {
    const eligible = pos.filter((p) => p.cur === "EUR" && p.cls === "actions" && ctx.invAccounts.find((a) => a.id === p.acct)?.kind === "cto")
    push("good", "ti-lock-open", `${eur(peaLeft)} de plafond PEA encore disponible`,
      "Le PEA est l'enveloppe la plus efficace pour les actions européennes : après 5 ans, seuls les 17,2 % de prélèvements sociaux s'appliquent, contre 30 % au CTO.",
      eligible.length
        ? `${eligible.map((p) => p.name).join(", ")} (${eur(eligible.reduce((s, p) => s + p.value, 0))}) sont éligibles au PEA — les y loger à l'avenir.`
        : "Y diriger en priorité les prochains versements actions.")
  }
  if (w("crypto") > (S.target.crypto || 0) + 1)
    push("mid", "ti-currency-bitcoin", `Crypto à ${pc(w("crypto"), 1)}`,
      `Au-delà de la cible ${S.target.crypto} % du profil ${profileLabel}.`,
      `Écrêter ${eur(((w("crypto") - S.target.crypto) / 100) * S.total)} ou ne plus renforcer.`)
  if (ctx.savingsBalance > 0)
    push("good", "ti-cash", `Épargne de précaution : ${eur(ctx.savingsBalance)} sur les livrets`,
      `Soit ${(ctx.savingsBalance / spend).toFixed(1)} mois de dépenses du foyer — ${ctx.savingsBalance / spend >= 3 ? "le matelas est constitué" : "le matelas reste à compléter"}.`,
      `Tout excédent au-delà de 6 mois (${eur(Math.max(0, ctx.savingsBalance - spend * 6))}) peut rejoindre les enveloppes longues.`)
  push("info", "ti-list-check", `${pos.length} lignes sur ${ctx.invAccounts.length} enveloppes`,
    `Répartition : ${envs.slice(0, 3).map((e) => `${e.k} ${pc(e.w, 0)}`).join(" · ")}.`,
    "Au-delà de 25 lignes, le suivi coûte plus qu'il ne rapporte : privilégier le renforcement à l'ajout.")

  const order = { high: 0, mid: 1, good: 2, info: 3 }
  return A.sort((a, b) => order[a.sev] - order[b.sev])
}

// ─── Simulation fiscale (bloc « Simulation fiscale ») ────────────────────────

export interface Row { label: string; value: string; hint?: string; cls?: string }

export function investTaxRows(S: PortfolioState, ctx: FinanceContext, tmi: number, plafondPer: number): Row[] {
  const kindOf = (id: string | null) => ctx.invAccounts.find((a) => a.id === id)?.kind
  const perAnnual = ctx.invAccounts.filter((a) => a.kind === "per").reduce((s, a) => s + a.monthly * 12, 0)
  const pvCto = S.pos.filter((p) => kindOf(p.acct) === "cto").reduce((s, p) => s + p.pv, 0)
  const pvPea = S.pos.filter((p) => ["pea", "peapme"].includes(kindOf(p.acct) ?? "")).reduce((s, p) => s + p.pv, 0)
  const pvCrypto = S.pos.filter((p) => p.cls === "crypto").reduce((s, p) => s + p.pv, 0)
  return [
    { label: "Économie d'impôt PER acquise", value: eur((perAnnual * tmi) / 100), hint: `${eur(perAnnual)} versés cette année · TMI ${tmi} %` },
    { label: "Plafond PER encore déductible", value: eur(plafondPer - perAnnual), hint: `plafond ${eur(plafondPer)} — soit ${eur(((plafondPer - perAnnual) * tmi) / 100)} d'impôt en moins` },
    { label: "PEA : gains latents exonérés d'IR", value: eurS(pvPea), hint: `plans ouverts depuis > 5 ans · 17,2 % de PS au retrait, soit ${eur(pvPea * 0.172)}` },
    { label: "CTO : impôt si vente aujourd'hui", value: eur(pvCto * 0.3), hint: `flat tax 30 % sur ${eurS(pvCto)} de plus-value latente` },
    { label: "Crypto : impôt si cession", value: eur(pvCrypto * 0.3), hint: `flat tax 30 % sur ${eurS(pvCrypto)}` },
    { label: "Assurance vie : abattement annuel", value: eur(4600), hint: "par personne après 8 ans de détention, sur la part de gains retirée" },
    { label: "Coût fiscal total d'une liquidation", value: eur(pvCto * 0.3 + pvCrypto * 0.3 + pvPea * 0.172), hint: "hors PER et PEE, imposés différemment" },
  ]
}

export interface FeeRow { k: string; v: number; w: number }
export function feeRows(S: PortfolioState, accts: CtxInvAccount[]): { rows: FeeRow[]; top: number } {
  const rows = S.pos
    .map((p) => {
      const acc = accts.find((a) => a.id === p.acct)
      return { k: p.name, v: (p.ter / 100) * p.value + ((acc?.fees ?? 0) / 100) * p.value, w: 0 }
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 7)
  rows.forEach((r) => (r.w = S.fees ? (r.v / S.fees) * 100 : 0))
  return { rows, top: rows.reduce((s, r) => s + r.v, 0) }
}

export const memberOf = (members: CtxMember[], id: string): CtxMember | undefined => members.find((m) => m.id === id)
