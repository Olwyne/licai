import { db } from "@/lib/db"
import { households, budgets, categories, recurring, goals, transactions } from "@/db/schema"
import { and, eq, gte } from "drizzle-orm"
import { buildFinanceContext } from "@/lib/server/finance-context"
import { ASSETS, INV_KINDS, computePortfolio } from "@/lib/finance/invest"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"

export const ASSISTANT_SYSTEM = `Tu es l'assistant financier du foyer dans l'application Lǐcái. Tu réponds en français, de façon directe et concrète, en t'appuyant EXCLUSIVEMENT sur les données du foyer fournies en JSON.
Les montants sont exprimés dans la devise de référence du foyer (champ « devise »), sauf mention contraire.
Règles : cite toujours les montants exacts issus des données ; propose des actions chiffrées et hiérarchisées ; signale quand une information manque plutôt que de l'inventer ; rappelle brièvement, quand le sujet est fiscal ou patrimonial, que ce n'est pas un conseil réglementé.
Format : phrases courtes, listes à puces avec « - », **gras** pour les montants clés, 200 mots maximum sauf demande d'analyse détaillée.`

const e = (cents: number) => Math.round(cents / 100)

/** Données du foyer transmises au modèle (montants dans la devise de référence du foyer) — mêmes informations que celles visibles dans l'app. */
export function buildAssistantSnapshot(householdId: string) {
  const ctx = buildFinanceContext(householdId)
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  const month = new Date().toISOString().slice(0, 7)
  const cats = new Map(db.select().from(categories).where(eq(categories.householdId, householdId)).all().map((c) => [c.id, c.label]))
  const bud = db.select().from(budgets).where(and(eq(budgets.householdId, householdId), eq(budgets.month, month))).all()
  const rec = db.select().from(recurring).where(and(eq(recurring.householdId, householdId), eq(recurring.active, true))).all()
  const gl = db.select().from(goals).where(eq(goals.householdId, householdId)).all()
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const tx = db.select().from(transactions).where(and(eq(transactions.householdId, householdId), gte(transactions.date, since))).all().filter((t) => t.kind !== "transfer")
  const byCat = new Map<string, number>()
  for (const t of tx.filter((t) => t.amountCents < 0)) byCat.set(cats.get(t.categoryId ?? "") ?? "Autre", (byCat.get(cats.get(t.categoryId ?? "") ?? "Autre") ?? 0) + Math.abs(t.amountCents))
  const S = computePortfolio(ctx, "equilibre")
  const T = computeTax(taxInputs(ctx), situationFor(ctx))

  return {
    foyer: { nom: hh?.name ?? "", ville: hh?.city ?? "", membres: ctx.members.map((m) => ({ nom: m.name, role: m.role, revenu_mensuel: m.incomeMonthly })) },
    comptes: ctx.cash.map((a) => ({ nom: a.name, type: a.type, devise: a.currency, solde: Math.round(a.native), solde_devise_ref: Math.round(a.balance) })),
    transactions_90_jours: {
      revenus: e(tx.filter((t) => t.amountCents > 0).reduce((a, t) => a + t.amountCents, 0)),
      depenses: e(tx.filter((t) => t.amountCents < 0).reduce((a, t) => a + Math.abs(t.amountCents), 0)),
      depenses_par_categorie: [...byCat].sort((a, b) => b[1] - a[1]).map(([categorie, c]) => ({ categorie, montant: e(c) })),
      dernieres: [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((t) => ({ date: t.date, libelle: t.name, categorie: cats.get(t.categoryId ?? "") ?? "Autre", montant: e(t.amountCents) })),
    },
    budgets: bud.map((b) => ({ categorie: cats.get(b.categoryId) ?? "Autre", plafond: e(b.limitCents) })),
    recurrent: rec.map((r) => ({ nom: r.name, montant_mensuel: Math.abs(e(frequencyToMonthlyCents(r.amountCents, r.frequency))), frequence: r.frequency, nature: r.kind })),
    credits: ctx.loans.map((l) => ({ nom: l.name, capital_restant: Math.round(l.left), mensualite: Math.round(l.monthly), taux: l.rate })),
    immobilier: ctx.properties.map((p) => ({ nom: p.name, usage: p.type, valeur: Math.round(p.value), prix_achat: Math.round(p.price), loyer_mensuel: p.rentMonthly })),
    objectifs: gl.map((g) => ({ nom: g.name, actuel: e(g.currentCents), cible: e(g.targetCents), echeance: g.deadline })),
    placements: S.pos.length ? {
      valorisation: Math.round(S.total), plus_value_latente: Math.round(S.pv), versements_cumules: Math.round(S.paid),
      versement_mensuel: Math.round(S.monthly), frais_moyens_pct: +S.ter.toFixed(2), tri_annualise_pct: +S.tri.toFixed(1),
      allocation: S.cls.map((c) => ({ classe: ASSETS[c.k as keyof typeof ASSETS]?.label ?? c.k, poids_pct: Math.round(c.w), montant: Math.round(c.v) })),
      enveloppes: ctx.invAccounts.map((a) => ({ type: INV_KINDS[a.kind].label, nom: a.name, verse: Math.round(a.paid), versement_mensuel: Math.round(a.monthly), frais_pct: a.fees })),
      lignes: S.pos.slice(0, 30).map((p) => ({ nom: p.name, classe: ASSETS[p.cls]?.label ?? p.cls, zone: p.zone, valeur: Math.round(p.value), poids_pct: +p.w.toFixed(1), plus_value: Math.round(p.pv), frais_pct: p.ter })),
    } : null,
    impots: {
      revenu_net_imposable: Math.round(T.rni), parts: T.parts, impot_revenu: Math.round(T.irNet), tmi_pct: T.tmi,
      taux_moyen_pct: +T.tauxMoyen.toFixed(1), prelevements_totaux: Math.round(T.totalPrel), regime_foncier: T.s.foncier,
      foncier_net: Math.round(T.foncier), per_verse: Math.round(T.perVerse), plafond_per_restant: Math.round(T.plafondPer - T.perVerse),
    },
    date_du_jour: new Date().toISOString().slice(0, 10), devise: ctx.currency,
  }
}
