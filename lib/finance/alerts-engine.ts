import type { FinanceContext } from "./types"
import type { TaxResult } from "./tax"
import { addMonths, grow, monthLabel } from "./amort"
import { eur, pc } from "./format"

// Alertes et échéancier dérivés des données du foyer (règles du prototype) — montants en euros.

export type AlertTone = "high" | "mid" | "good" | "info"
export type AlertKind = "echeance" | "optim" | "budget" | "anomalie"

export interface DerivedAlert {
  id: string
  kind: AlertKind
  tone: AlertTone
  icon: string
  due: string | null // YYYY-MM-DD
  title: string
  text: string
  action?: string | null
  href?: string
}

export interface AlertInputs {
  today: string
  ctx: FinanceContext
  tax: TaxResult
  budgetsOver: { id: string; label: string; icon: string; spent: number; limit: number; avg3: number }[]
  recurring: { id: string; name: string; monthly: number; amount: number; frequency: "monthly" | "quarterly" | "annual"; kind: string; active: boolean; nextDate: string }[]
  goals: { id: string; name: string; current: number; target: number; deadline: string | null; risk: string; monthly: number | null }[]
  forecast: { ym: string; balance: number; buffer: number; extras: string[] } | null
}

export const DEADLINES = [
  { id: "d-ir", label: "Déclaration de revenus", when: "06-06", icon: "ti-file-description", note: "Télédéclaration — zone 2" },
  { id: "d-tf", label: "Taxe foncière", when: "10-15", icon: "ti-home-dollar", note: "Paiement en ligne jusqu'au 20" },
  { id: "d-th", label: "Solde de l'impôt sur le revenu", when: "09-25", icon: "ti-receipt-tax", note: "Prélèvement du solde ou remboursement" },
  { id: "d-per", label: "Dernier versement PER déductible", when: "12-31", icon: "ti-parachute", note: "Au-delà, le plafond de l'année est perdu" },
]

const LIVRET_CAPS: [RegExp, string, number][] = [
  [/ldds|ldd\b|développement durable/i, "LDDS", 12000],
  [/livret a\b/i, "Livret A", 22950],
  [/lep\b/i, "LEP", 10000],
  [/livret jeune/i, "Livret jeune", 1600],
]
const RISK_RETURN: Record<string, number> = { prudent: 2.5, equilibre: 4.5, dynamique: 6.5 }
const VOL: Record<string, number> = { prudent: 4, equilibre: 9, dynamique: 14 }

const MS = 86400000
export const daysBetween = (a: string, b: string): number => Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS)
const ym = (iso: string) => iso.slice(0, 7)
const monthsBetween = (a: string, b: string): number => {
  const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number)
  return yb * 12 + mb - (ya * 12 + ma)
}

/** Prochaine occurrence d'une date récurrente « MM-JJ ». */
export function nextOccurrence(md: string, today: string): string {
  const y = Number(today.slice(0, 4))
  const cand = `${y}-${md}`
  return cand >= today ? cand : `${y + 1}-${md}`
}

/** Loi normale cumulée (Abramowitz-Stegun). */
export function cdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z >= 0 ? 1 - p : p
}

export function goalOutlook(g: AlertInputs["goals"][number], today: string): { months: number; proj: number; prob: number; need: number } | null {
  if (!g.deadline || g.monthly == null) return null
  const months = Math.max(0, monthsBetween(ym(today), ym(g.deadline)))
  const r = RISK_RETURN[g.risk] ?? 4.5
  const proj = grow(g.current, g.monthly, months / 12, r)
  const need = months ? (g.target - grow(g.current, 0, months / 12, r)) / months : g.target - g.current
  const vol = ((VOL[g.risk] ?? 9) / 100) * Math.sqrt(Math.max(0.25, months / 12))
  const p = proj <= 0 ? 0 : cdf(Math.log(proj / g.target) / (vol || 0.01))
  return { months, proj, prob: Math.max(0, Math.min(1, p)), need: Math.max(0, need) }
}

export function deriveAlerts(inp: AlertInputs): DerivedAlert[] {
  const { today, ctx, tax: T } = inp
  const year = Number(today.slice(0, 4))
  const out: DerivedAlert[] = []
  const add = (a: Omit<DerivedAlert, "tone" | "kind"> & { tone?: AlertTone; kind?: AlertKind }) => out.push({ tone: "info", kind: "optim", ...a })

  // calendrier fiscal
  for (const d of DEADLINES) {
    const due = nextOccurrence(d.when, today)
    if (d.id === "d-tf" && !ctx.properties.length) continue
    add({ id: d.id, kind: "echeance", tone: daysBetween(today, due) < 30 ? "high" : "info", icon: d.icon, due, title: d.label, text: d.note, href: "/impots" })
  }

  // PER
  const room = Math.max(0, T.plafondPer - T.perVerse)
  if (room > 500) {
    const left = Math.max(1, 12 - Number(today.slice(5, 7)))
    add({ id: "per-room", kind: "optim", tone: "high", icon: "ti-parachute", due: `${year}-12-31`,
      title: `Plafond PER disponible : ${eur(room)}`,
      text: `À la TMI de ${pc(T.tmi, 0)}, verser ce montant réduirait l'impôt de ${eur((room * T.tmi) / 100)}. Le plafond non utilisé de l'année reste reportable 3 ans.`,
      action: `Programmer un versement avant le 31 décembre — ${eur(room / left)}/mois sur les ${left} mois restants.`, href: "/impots" })
  }

  // plafonds de livrets
  for (const a of ctx.cash.filter((x) => x.type === "savings")) {
    const cap = LIVRET_CAPS.find(([re]) => re.test(a.name))
    if (!cap) continue
    const fill = (a.balance / cap[2]) * 100
    if (fill > 75)
      add({ id: "ceil-" + a.id, kind: "echeance", tone: fill > 95 ? "high" : "mid", icon: "ti-pig-money", due: null,
        title: `${cap[1]} rempli à ${pc(fill, 0)}`,
        text: `${eur(a.balance)} sur un plafond de ${eur(cap[2])} — il reste ${eur(Math.max(0, cap[2] - a.balance))} de capacité.`,
        action: fill > 95 ? "Orienter les prochains versements vers l'assurance vie ou le PEA." : null, href: "/comptes" })
  }

  // budgets dépassés
  for (const b of inp.budgetsOver) {
    add({ id: "bud-" + b.id, kind: "budget", tone: "high", icon: b.icon, due: null,
      title: `Budget ${b.label} dépassé de ${eur(b.spent - b.limit)}`,
      text: `${eur(b.spent)} dépensés pour un plafond de ${eur(b.limit)}.${b.avg3 ? ` La moyenne des trois derniers mois est de ${eur(b.avg3)}.` : ""}`,
      action: "Relever le plafond s'il n'est plus réaliste, ou identifier la dépense à réduire.", href: "/budget" })
  }

  // estimations immobilières anciennes
  for (const p of ctx.properties) {
    if (!p.estimatedAt) continue
    const m = monthsBetween(ym(p.estimatedAt), ym(today))
    if (m >= 12)
      add({ id: "est-" + p.id, kind: "echeance", tone: m >= 18 ? "mid" : "info", icon: "ti-home-search", due: null,
        title: `Estimation de ${p.name} vieille de ${m} mois`,
        text: `Dernière valorisation en ${monthLabel(ym(p.estimatedAt))}${p.estimateSource ? ` (${p.estimateSource})` : ""} à ${eur(p.value)}. Le patrimoine net et l'assiette IFI en dépendent.`,
        action: "Mettre à jour l'estimation depuis l'écran Patrimoine.", href: "/patrimoine" })
  }

  // crédits : fin proche & taux élevés
  for (const c of ctx.loans) {
    if (c.endDate) {
      const m = monthsBetween(ym(today), ym(c.endDate))
      if (m <= 12 && m > 0)
        add({ id: "cred-end-" + c.id, kind: "echeance", tone: "good", icon: "ti-flag-check", due: ym(c.endDate) + "-01",
          title: `${c.name} soldé dans ${m} mois`,
          text: `${eur(c.monthly)} de mensualité seront libérés à partir de ${monthLabel(addMonths(ym(c.endDate), 1))}.`,
          action: `Réaffecter cette somme : ${eur(c.monthly * 12)} par an d'épargne supplémentaire.`, href: "/credits" })
    }
    if (c.rate >= 4 && c.left > 3000)
      add({ id: "cred-rate-" + c.id, kind: "optim", tone: "mid", icon: "ti-percentage", due: null,
        title: `${c.name} à ${pc(c.rate, 2)}`,
        text: `Capital restant ${eur(c.left)}. Un remboursement anticipé rapporte un rendement net et sans risque de ${pc(c.rate, 2)}, supérieur à celui d'un fonds euro.`,
        action: "Simuler dans l'écran Crédits (tableau & anticipé).", href: "/credits" })
  }

  // enveloppes : seuils d'ancienneté
  for (const a of ctx.invAccounts) {
    const age = year - a.since
    if ((a.kind === "pea" || a.kind === "peapme") && age >= 5)
      add({ id: "pea5-" + a.id, kind: "optim", tone: "good", icon: "ti-lock-open", due: null,
        title: `${a.name} : cap des 5 ans franchi`,
        text: "Les retraits partiels sont possibles sans clôture du plan et les gains sont exonérés d'impôt sur le revenu (prélèvements sociaux dus).",
        action: "Utilisable comme réserve de liquidité de second rang.", href: "/placements" })
    if (a.kind === "av" && age === 7)
      add({ id: "av8-" + a.id, kind: "echeance", tone: "info", icon: "ti-hourglass", due: `${a.since + 8}-01-01`,
        title: `${a.name} : 8 ans atteints en ${a.since + 8}`,
        text: "Après 8 ans, l'abattement annuel de 4 600 € (9 200 € pour un couple) s'applique sur les gains retirés et le taux tombe à 7,5 %.",
        action: "Décaler un retrait important après cette date si la trésorerie le permet.", href: "/placements" })
  }

  // trésorerie tendue
  const F = inp.forecast
  if (F && F.balance < F.buffer)
    add({ id: "cash-low", kind: "echeance", tone: F.balance < 0 ? "high" : "mid", icon: "ti-wave-saw-tool", due: F.ym + "-01",
      title: `Trésorerie tendue en ${monthLabel(F.ym)}`,
      text: `Solde projeté de ${eur(F.balance)} contre un matelas conseillé de ${eur(F.buffer)}${F.extras.length ? ` — ${F.extras.map((x) => x.toLowerCase()).join(" et ")} tombent ce mois-là` : ""}.`,
      action: "Lisser la dépense exceptionnelle ou réduire temporairement le virement d'épargne.", href: "/previsions" })

  // fonds d'urgence & cash dormant
  const liquid = ctx.cash.reduce((s, a) => s + a.balance, 0)
  const spend = ctx.monthlySpend
  if (spend > 0) {
    const cover = liquid / spend
    if (cover < 3)
      add({ id: "emergency", kind: "optim", tone: "high", icon: "ti-shield-half", due: null,
        title: `Épargne de précaution : ${cover.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois de dépenses`,
        text: `${eur(liquid)} disponibles pour ${eur(spend)} de dépenses mensuelles. La cible usuelle est de 3 à 6 mois.`,
        action: `Compléter de ${eur(spend * 3 - liquid)} avant de renforcer les placements.`, href: "/objectifs" })
    else if (cover > 6)
      add({ id: "idle-cash", kind: "optim", tone: "mid", icon: "ti-cash-off", due: null,
        title: `${eur(liquid - spend * 6)} de liquidités dormantes`,
        text: `${cover.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois de dépenses sont sur des comptes peu ou pas rémunérés.`,
        action: "Orienter l'excédent vers le fonds euro ou une allocation diversifiée.", href: "/placements" })
  }

  // abonnements
  const abos = inp.recurring.filter((r) => r.active && r.kind === "subscription")
  const aboMonthly = abos.reduce((s, r) => s + r.monthly, 0)
  const paused = inp.recurring.filter((r) => !r.active).length
  if (aboMonthly > 0)
    add({ id: "abos", kind: "optim", tone: aboMonthly > 60 ? "mid" : "info", icon: "ti-repeat", due: null,
      title: `${eur(aboMonthly)}/mois d'abonnements`,
      text: `Soit ${eur(aboMonthly * 12)} par an sur ${abos.length} abonnement${abos.length > 1 ? "s" : ""} actif${abos.length > 1 ? "s" : ""}${paused ? ` (${paused} en pause)` : ""}.`,
      action: "Passer en revue les doublons et les services non utilisés depuis 3 mois.", href: "/recurrent" })

  // IFI proche du seuil
  const debtImmo = ctx.loans.filter((l) => l.kind === "immobilier" || l.kind === "travaux").reduce((s, l) => s + l.left, 0)
  const ifiBase = ctx.properties.reduce((s, p) => s + p.value * (p.type === "principale" ? 0.7 : 1), 0) - debtImmo
  if (ifiBase > 1300000 * 0.85)
    add({ id: "ifi", kind: "echeance", tone: "mid", icon: "ti-building-bank", due: null, title: "Assiette IFI proche du seuil",
      text: `${eur(ifiBase)} d'assiette pour un seuil de 1 300 000 €.`, action: "Suivre l'évolution dans Prévoyance.", href: "/prevoyance" })

  // dividendes
  if (T.s.dividendes > 0)
    add({ id: "div", kind: "echeance", tone: "info", icon: "ti-coins", due: nextOccurrence("06-06", today),
      title: `${eur(T.s.dividendes)} de dividendes à déclarer`,
      text: "L'option pour le barème au lieu du prélèvement forfaitaire est globale et se coche à la déclaration.",
      action: `À la TMI de ${pc(T.tmi, 0)}, le prélèvement forfaitaire reste plus favorable.`, href: "/impots" })

  // objectifs en retard
  for (const g of inp.goals) {
    if (g.current >= g.target) continue
    const c = goalOutlook(g, today)
    if (!c || c.months < 3) continue
    if (c.prob < 0.5)
      add({ id: "goal-" + g.id, kind: "optim", tone: "mid", icon: "ti-target", due: g.deadline,
        title: `Objectif « ${g.name} » : ${pc(c.prob * 100, 0)} de chances d'aboutir`,
        text: `Projection de ${eur(c.proj)} pour une cible de ${eur(g.target)} en ${monthLabel(ym(g.deadline!))}, avec ${eur(g.monthly ?? 0)}/mois.`,
        action: `Porter l'effort à ${eur(c.need)}/mois ou décaler l'échéance.`, href: "/objectifs" })
  }

  const rank = { high: 0, mid: 1, good: 2, info: 3 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone] || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
}

// ─── Calendrier des 12 prochains mois ────────────────────────────────────────

export interface CalItem { label: string; value: number | null }
export interface CalMonth { ym: string; items: CalItem[] }

export function buildCalendar(inp: AlertInputs, alerts: DerivedAlert[]): CalMonth[] {
  const start = ym(inp.today)
  const months: CalMonth[] = []
  for (let i = 0; i < 12; i++) {
    const m = addMonths(start, i)
    const mi = Number(m.split("-")[1])
    const items: CalItem[] = []
    alerts.filter((a) => a.due && a.due.startsWith(m)).forEach((a) => items.push({ label: a.title, value: null }))
    for (const r of inp.recurring.filter((x) => x.active && x.frequency !== "monthly")) {
      const rm = Number(r.nextDate.slice(5, 7))
      const due = r.frequency === "annual" ? rm === mi : (((mi - rm) % 3) + 3) % 3 === 0
      if (due) items.push({ label: `${r.name} (${r.frequency === "annual" ? "annuel" : "trimestriel"})`, value: r.amount })
    }
    if (mi === 10) {
      const tf = inp.ctx.properties.reduce((s, p) => s + p.costs.taxe, 0)
      if (tf > 0) items.push({ label: "Taxe foncière", value: tf })
    }
    for (const c of inp.ctx.loans.filter((l) => l.endDate && ym(l.endDate) === m)) items.push({ label: `Dernière échéance — ${c.name}`, value: c.monthly })
    if (items.length) months.push({ ym: m, items })
  }
  return months
}
