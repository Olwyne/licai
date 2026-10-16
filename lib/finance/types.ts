// Contexte financier du foyer, en euros (nombres), partagé par Placements, Impôts et Prévoyance.
// Construit côté serveur par lib/finance/context.ts, consommé côté client par les moteurs de calcul.

export type InvKind = "av" | "pea" | "peapme" | "cto" | "per" | "pee" | "crypto" | "livret"
export type AssetClass = "actions" | "obligations" | "euro" | "immobilier" | "monetaire" | "crypto"
export type ResidenceType = "principale" | "secondaire" | "locatif"

export interface CtxMember {
  id: string
  name: string
  short: string
  role: string
  color: string
  incomeMonthly: number
  birthYear: number | null
  isChild: boolean
}

export interface CtxCashAccount {
  id: string
  name: string
  type: "checking" | "savings" | "investment" | "card" | "other"
  currency: string
  native: number // solde dans la devise du compte
  balance: number // en euro (devise convertie)
  ownerIds: string[]
}

export interface PropertyCosts {
  copro: number; taxe: number; assur: number; gestion: number; travaux: number // €/an
  vacance: number // % des loyers
  notaire: number // frais d'acquisition (€)
}

export interface CtxProperty {
  id: string
  name: string
  city: string
  type: ResidenceType
  value: number
  price: number
  rentMonthly: number
  costs: PropertyCosts
  estimatedAt: string | null // dernière estimation (YYYY-MM-DD)
  estimateSource: string
  surface: number | null
  shares: Record<string, number> // memberId -> % de détention
}

export interface CtxLoan {
  id: string
  name: string
  kind: string // immobilier | auto | conso | travaux | autre
  left: number
  monthly: number
  rate: number
  propertyId: string | null
  endDate: string | null // "YYYY-MM" ou "YYYY-MM-DD"
}

export interface CtxInvAccount {
  id: string
  kind: InvKind
  name: string
  bank: string
  ownerIds: string[]
  benefIds: string[]
  since: number
  paid: number
  monthly: number
  fees: number
  match: number
}

export interface CtxHolding {
  id: string
  acct: string | null
  name: string
  tk: string
  cls: AssetClass
  zone: string
  sector: string
  cur: string
  cap: string
  qty: number
  pru: number
  price: number
  prev: number | null
  ter: number
  gain: number | null
}

export interface CtxFlow { id: string; ym: string; amount: number; match: number; note: string }
export interface CtxSnapshot { ym: string; value: number; bench: number | null }

export interface FinanceContext {
  year: number
  month: number // 1-12
  members: CtxMember[]
  cash: CtxCashAccount[]
  properties: CtxProperty[]
  loans: CtxLoan[]
  invAccounts: CtxInvAccount[]
  holdings: CtxHolding[]
  monthlySpend: number // dépenses mensuelles moyennes du foyer (3 derniers mois)
  savingsBalance: number // livrets / épargne de précaution
  taxSituation: Partial<TaxSituation>
  fx: Record<string, number> // taux : 1 unité de devise = X €
  fxSource: "demo" | "manual" | "api"
  fxTs: string
  flows: CtxFlow[] // versements du foyer, du plus ancien au plus récent (6 derniers mois)
  history: CtxSnapshot[] // valorisation mensuelle du portefeuille, du plus ancien au plus récent
}

export interface TaxSituation {
  year: number
  couple: boolean
  dependents: number
  youngKids: number
  fraisReels: number // 0 = abattement 10 %
  foncier: "micro" | "reel"
  chargesFoncieres: number
  travaux: number
  dons: number
  domicile: number
  garde: number
  autres: number
  dividendes: number
  interets: number
  perExtra?: number
}
