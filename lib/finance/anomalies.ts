import { normalizeMerchant } from "./categorize"
import { eur, pc } from "./format"
import type { DerivedAlert } from "./alerts-engine"

// Détection d'anomalies dans les dépenses : abonnements en double, hausse d'un prélèvement, dépense inhabituelle. Montants en euros.

export interface AnomalyTx { id: string; name: string; amount: number; date: string; categoryId: string | null }
export interface AnomalyRecurring { id: string; name: string; amount: number; frequency: string; kind: string; active: boolean }
export interface AnomalyInput {
  today: string
  /** Dépenses (montants positifs) des ~12 derniers mois, hors virements internes. */
  txs: AnomalyTx[]
  recurring: AnomalyRecurring[]
  categories: Map<string, { label: string; icon: string }>
}

const MS = 86400000
const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS)
const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
/** Montant lisible : centimes sous 100 € (19,99 €), arrondi au-delà. */
const money = (x: number): string => (x < 100 && !Number.isInteger(x) ? `${x.toFixed(2).replace(".", ",")} €` : eur(x))
const slug = (s: string) => normalizeMerchant(s).replace(/ /g, "-") || "x"

/** Coefficient de recouvrement des mots : 1 quand les mots du nom le plus court sont tous dans l'autre (« Netflix » / « Netflix Premium »). */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((w) => w.length > 2)), tb = new Set(b.split(" ").filter((w) => w.length > 2))
  if (!ta.size || !tb.size) return 0
  return [...ta].filter((w) => tb.has(w)).length / Math.min(ta.size, tb.size)
}

export function detectAnomalies(inp: AnomalyInput): DerivedAlert[] {
  const out: DerivedAlert[] = []
  const { today } = inp

  // 1. Abonnements en double : deux abonnements actifs de même nom (ou quasi), ou deux débits identiques rapprochés
  const subs = inp.recurring.filter((r) => r.active && r.kind === "subscription")
  const flagged = new Set<string>()
  for (let i = 0; i < subs.length; i++) for (let j = i + 1; j < subs.length; j++) {
    const a = normalizeMerchant(subs[i].name), b = normalizeMerchant(subs[j].name)
    if (!a || !b || (a !== b && tokenOverlap(a, b) < 1)) continue
    const key = [subs[i].id, subs[j].id].sort().join("-")
    if (flagged.has(key)) continue
    flagged.add(key)
    out.push({ id: `an-dup-${slug(subs[i].name)}-${slug(subs[j].name)}`, kind: "anomalie", tone: "mid", icon: "ti-copy", due: null,
      title: `Abonnement en double : ${subs[i].name}`,
      text: `« ${subs[i].name} » (${money(subs[i].amount)}) et « ${subs[j].name} » (${money(subs[j].amount)}) semblent être le même abonnement : ${eur(Math.min(subs[i].amount, subs[j].amount) * 12)} / an à économiser s'il s'agit d'un doublon.`,
      action: "Vérifier et résilier le doublon", href: "/recurrent" })
  }
  const recent = inp.txs.filter((t) => days(t.date, today) >= 0 && days(t.date, today) <= 45)
  const groups = new Map<string, AnomalyTx[]>()
  for (const t of recent) { const k = `${normalizeMerchant(t.name)}|${t.amount.toFixed(2)}`; groups.set(k, [...(groups.get(k) ?? []), t]) }
  for (const [k, g] of groups) {
    if (g.length < 2 || k.startsWith("|")) continue
    const sorted = [...g].sort((a, b) => a.date.localeCompare(b.date))
    // deux débits identiques à moins de 5 jours : double prélèvement probable (un abonnement mensuel serait espacé de ~30 jours)
    const pair = sorted.slice(1).find((t, i) => days(sorted[i].date, t.date) <= 5)
    if (!pair) continue
    out.push({ id: `an-double-${slug(pair.name)}-${pair.date}`, kind: "anomalie", tone: "mid", icon: "ti-alert-circle", due: pair.date,
      title: `Double débit possible : ${pair.name}`,
      text: `${money(pair.amount)} débités ${g.length} fois à quelques jours d'intervalle (dernier : ${pair.date}).`,
      action: "Vérifier sur le relevé", href: "/transactions" })
  }

  // 2. Hausse d'un prélèvement : commerçant à débit régulier (≥ 3 occurrences espacées de ~1 mois) dont le dernier montant dépasse l'habituel
  const byMerchant = new Map<string, AnomalyTx[]>()
  for (const t of inp.txs) { const k = normalizeMerchant(t.name); if (k.length >= 3) byMerchant.set(k, [...(byMerchant.get(k) ?? []), t]) }
  for (const [k, list] of byMerchant) {
    const s = [...list].sort((a, b) => a.date.localeCompare(b.date))
    if (s.length < 3) continue
    const gaps = s.slice(1).map((t, i) => days(s[i].date, t.date))
    const monthly = gaps.filter((g) => g >= 24 && g <= 38).length >= Math.ceil(gaps.length * 0.6)
    if (!monthly) continue
    const last = s[s.length - 1]
    if (days(last.date, today) > 70) continue
    const prior = s.slice(0, -1).map((t) => t.amount)
    const usual = median(prior)
    // un prélèvement fixe : les montants précédents sont quasi identiques (sinon ce sont des achats courants, ex. courses)
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length
    const cv = mean > 0 ? Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / prior.length) / mean : 1
    if (cv > 0.08) continue
    if (usual <= 0 || last.amount < usual * 1.1 || last.amount - usual < 1) continue
    out.push({ id: `an-hike-${slug(k)}-${last.date.slice(0, 7)}`, kind: "anomalie", tone: last.amount >= usual * 1.25 ? "high" : "mid", icon: "ti-trending-up", due: last.date,
      title: `Hausse de prélèvement : ${last.name}`,
      text: `Passé de ${money(usual)} à ${money(last.amount)} (+${pc(((last.amount / usual) - 1) * 100, 0)}), soit ${eur((last.amount - usual) * 12)} de plus par an.`,
      action: "Contester ou renégocier", href: "/transactions" })
  }

  // 3. Dépense inhabituelle : montant très au-dessus de l'habitude de la catégorie (30 derniers jours)
  const byCat = new Map<string, AnomalyTx[]>()
  for (const t of inp.txs) if (t.categoryId) byCat.set(t.categoryId, [...(byCat.get(t.categoryId) ?? []), t])
  for (const [cat, list] of byCat) {
    const past = list.filter((t) => days(t.date, today) > 30)
    if (past.length < 5) continue
    const amounts = past.map((t) => t.amount)
    const med = median(amounts)
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length)
    const limit = Math.max(med * 3, mean + 3 * sd, 50)
    for (const t of list.filter((t) => days(t.date, today) >= 0 && days(t.date, today) <= 30 && t.amount > limit)) {
      const c = inp.categories.get(cat)
      out.push({ id: `an-out-${t.id}`, kind: "anomalie", tone: "mid", icon: c?.icon ?? "ti-bolt", due: t.date,
        title: `Dépense inhabituelle : ${t.name}`,
        text: `${money(t.amount)} en ${c?.label ?? "cette catégorie"}, alors que la dépense habituelle est d'environ ${money(med)}.`,
        action: "Vérifier la transaction", href: "/transactions" })
    }
  }
  return out
}
