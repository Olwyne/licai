import type { FinanceContext, TaxSituation } from "./types"
import { eur, pc, type Advice } from "./format"

// Barème (revenus 2025, impôt 2026)
export const BRACKETS: [number, number][] = [[11497, 0], [29315, 0.11], [83823, 0.3], [180294, 0.41], [Infinity, 0.45]]
export const P = {
  absMin: 504, absMax: 14171,
  qfCap: 1791,
  decoteCouple: 1470, decoteSeul: 889, decoteRate: 0.4525, decoteMaxCouple: 1964, decoteMaxSeul: 1929,
  ps: 0.172,
  pfu: 0.128,
  perFloor: 4637, perCap: 37094,
  microAbat: 0.3,
  deficitCap: 10700,
  donRate: 0.66, donCapPct: 0.2,
  domRate: 0.5, domCap: 12000,
  gardeRate: 0.5, gardeCap: 3500,
  ifiThreshold: 1300000,
}

export const DEFAULT_SITUATION: TaxSituation = {
  year: new Date().getFullYear(),
  couple: true, dependents: 0, youngKids: 0,
  fraisReels: 0, foncier: "reel", chargesFoncieres: 0, travaux: 0,
  dons: 0, domicile: 0, garde: 0, autres: 0, dividendes: 0, interets: 0,
}

export const mergeSituation = (s: Partial<TaxSituation> | undefined): TaxSituation => ({ ...DEFAULT_SITUATION, ...(s ?? {}) })

// Situation du foyer : valeurs par défaut déduites des membres (enfants à charge, moins de 6 ans), surchargées par la saisie
export function situationFor(ctx: FinanceContext): TaxSituation {
  const kids = ctx.members.filter((m) => m.isChild)
  const young = kids.filter((m) => m.birthYear != null && ctx.year - m.birthYear < 6).length
  const adults = ctx.members.filter((m) => !m.isChild).length
  return mergeSituation({ couple: adults > 1, dependents: kids.length, youngKids: young, ...ctx.taxSituation })
}

export interface BracketDetail { from: number; to: number; rate: number; base: number; tax: number }

export function bareme(perPart: number): { tax: number; detail: BracketDetail[] } {
  let t = 0, prev = 0
  const detail: BracketDetail[] = []
  for (const [cap, rate] of BRACKETS) {
    const base = Math.max(0, Math.min(perPart, cap) - prev)
    if (base > 0) { t += base * rate; detail.push({ from: prev, to: cap, rate, base, tax: base * rate }) }
    prev = cap
  }
  return { tax: t, detail }
}

export function marginal(perPart: number): number {
  for (const [cap, rate] of BRACKETS) if (perPart <= cap) return rate * 100
  return 45
}

export interface TaxInputs {
  salaries: { id: string; short: string; annual: number }[]
  loyers: number
  interetsLocatif: number
  perVerse: number
}

export function taxInputs(ctx: FinanceContext): TaxInputs {
  const salaries = ctx.members.filter((m) => !m.isChild && m.incomeMonthly > 0).map((m) => ({ id: m.id, short: m.short, annual: m.incomeMonthly * 12 }))
  const rented = ctx.properties.filter((p) => p.rentMonthly > 0)
  const loyers = rented.reduce((a, p) => a + p.rentMonthly * 12, 0)
  const interetsLocatif = ctx.loans
    .filter((l) => ctx.properties.find((p) => p.id === l.propertyId)?.type === "locatif")
    .reduce((a, l) => a + (l.left * l.rate) / 100, 0)
  const perVerse = ctx.invAccounts.filter((a) => a.kind === "per").reduce((a, x) => a + x.monthly * 12, 0)
  return { salaries, loyers, interetsLocatif, perVerse }
}

export interface TaxResult {
  s: TaxSituation
  salTotal: number; abat: number; salNet: number
  loyers: number; interets: number
  foncierMicro: number; foncierReel: number; foncier: number; deficit: number
  perVerse: number; plafondPer: number
  rbg: number; rni: number; parts: number
  bar: { tax: number; detail: BracketDetail[] }
  ir: number; irSansEnfants: number; avantage: number; capQf: number; qfCapped: number
  decote: number; irApresDecote: number
  redDons: number; redDom: number; redGarde: number; reductions: number
  irNet: number
  psFoncier: number; psCapitaux: number; irCapitaux: number; totalPrel: number
  revenusReels: number; tmi: number; tauxMoyen: number; tauxGlobal: number; pasRate: number
}

export function computeTax(inp: TaxInputs, situation: TaxSituation, over: Partial<TaxSituation> = {}): TaxResult {
  const s = { ...situation, ...over }
  const salTotal = inp.salaries.reduce((a, x) => a + x.annual, 0)
  const abat = s.fraisReels > 0 ? s.fraisReels : inp.salaries.reduce((a, x) => a + Math.min(P.absMax, Math.max(P.absMin, x.annual * 0.1)), 0)
  const salNet = salTotal - abat

  const loyers = inp.loyers
  const interets = inp.interetsLocatif
  const foncierMicro = loyers * (1 - P.microAbat)
  const foncierReel = loyers - interets - s.chargesFoncieres - s.travaux
  const foncier = s.foncier === "micro" ? Math.max(0, foncierMicro) : foncierReel
  const deficit = foncier < 0 ? Math.min(P.deficitCap, -foncier) : 0

  const perVerse = inp.perVerse
  const plafondPer = Math.min(P.perCap, Math.max(P.perFloor, salNet * 0.1))

  const rbg = salNet + Math.max(0, foncier) - deficit
  const rni = Math.max(0, rbg - perVerse - (s.perExtra ?? 0))
  const parts = (s.couple ? 2 : 1) + (s.dependents <= 2 ? s.dependents * 0.5 : 1 + (s.dependents - 2))

  const bar = bareme(rni / parts)
  let ir = bar.tax * parts
  const partsSansEnfants = s.couple ? 2 : 1
  const irSansEnfants = bareme(rni / partsSansEnfants).tax * partsSansEnfants
  const avantage = irSansEnfants - ir
  const capQf = (parts - partsSansEnfants) * 2 * P.qfCap
  let qfCapped = 0
  if (avantage > capQf) { qfCapped = avantage - capQf; ir = irSansEnfants - capQf }
  const seuil = s.couple ? P.decoteMaxCouple : P.decoteMaxSeul
  const decote = ir > 0 && ir < seuil ? Math.max(0, (s.couple ? P.decoteCouple : P.decoteSeul) - P.decoteRate * ir) : 0
  const irApresDecote = Math.max(0, ir - decote)

  const donBase = Math.min(s.dons, rni * P.donCapPct)
  const redDons = donBase * P.donRate
  const redDom = Math.min(s.domicile, P.domCap) * P.domRate
  const redGarde = Math.min(s.garde, P.gardeCap * Math.max(1, s.youngKids)) * P.gardeRate
  const reductions = redDons + redDom + redGarde + s.autres
  const irNet = Math.max(0, irApresDecote - reductions)

  const psFoncier = Math.max(0, foncier) * P.ps
  const psCapitaux = (s.dividendes + s.interets) * P.ps
  const irCapitaux = (s.dividendes + s.interets) * P.pfu
  const totalPrel = irNet + psFoncier + psCapitaux + irCapitaux

  const revenusReels = salTotal + loyers + s.dividendes + s.interets
  const tmi = marginal(rni / parts)
  const baseAs = salTotal + Math.max(0, foncier)
  return {
    s, salTotal, abat, salNet, loyers, interets, foncierMicro, foncierReel, foncier, deficit, perVerse, plafondPer,
    rbg, rni, parts, bar, ir, irSansEnfants, avantage, capQf, qfCapped, decote, irApresDecote,
    redDons, redDom, redGarde, reductions, irNet, psFoncier, psCapitaux, irCapitaux, totalPrel,
    revenusReels, tmi,
    tauxMoyen: revenusReels ? (irNet / revenusReels) * 100 : 0,
    tauxGlobal: revenusReels ? (totalPrel / revenusReels) * 100 : 0,
    pasRate: baseAs ? (irNet / baseAs) * 100 : 0,
  }
}

// ─── Pistes d'optimisation ───────────────────────────────────────────────────

export function taxAdvice(ctx: FinanceContext, inp: TaxInputs, R: TaxResult): { list: Advice[]; totalGain: number } {
  const A: Advice[] = []
  const add = (sev: Advice["sev"], icon: string, title: string, text: string, gain: number, action: string) =>
    A.push({ sev, icon, title, text, gain, action })
  const compute = (over: Partial<TaxSituation>) => computeTax(inp, R.s, over)
  const gainOf = (over: Partial<TaxSituation>) => Math.max(0, R.totalPrel - compute(over).totalPrel)
  const hasRent = R.loyers > 0
  const peaUsed = ctx.invAccounts.filter((a) => a.kind === "pea").reduce((s, a) => s + a.paid, 0)

  if (hasRent) {
    const gainRegime = gainOf({ foncier: R.s.foncier === "micro" ? "reel" : "micro" })
    if (R.s.foncier === "micro" && R.foncierReel < R.foncierMicro)
      add("high", "ti-home-dollar", "Passer les revenus fonciers au régime réel",
        `Au réel, la base imposable tombe à ${eur(Math.max(0, R.foncierReel))} contre ${eur(R.foncierMicro)} au micro-foncier : les intérêts d'emprunt (${eur(R.interets)}) et les charges (${eur(R.s.chargesFoncieres)}) deviennent déductibles.`,
        gainRegime, "Option à exercer sur la déclaration 2044 — engageante 3 ans.")
    else if (R.s.foncier === "reel" && R.foncierMicro < Math.max(0, R.foncierReel))
      add("mid", "ti-home-dollar", "Le micro-foncier serait plus favorable",
        `L'abattement forfaitaire de 30 % (${eur(R.loyers * 0.3)}) dépasse vos charges réelles déductibles.`,
        gainRegime, "Revenir au micro-foncier à la fin de la période d'engagement.")
    else
      add("good", "ti-home-dollar", "Régime foncier optimal",
        `Le régime ${R.s.foncier === "reel" ? "réel" : "micro-foncier"} est le plus favorable dans votre configuration.`, 0, "Rien à changer cette année.")

    const gTrav = gainOf({ travaux: P.deficitCap })
    add("mid", "ti-tools", "Travaux sur le locatif : déficit foncier",
      `Des travaux d'entretien ou d'amélioration s'imputent sur les loyers, puis jusqu'à ${eur(P.deficitCap)} sur le revenu global.`,
      gTrav, `${eur(P.deficitCap)} de travaux effacent ${eur(gTrav)} d'impôt et de prélèvements sociaux (le solde non imputé est reportable).`)
  }

  const perRoom = R.plafondPer - R.perVerse
  const perGain = gainOf({ perExtra: Math.max(0, perRoom) })
  if (R.tmi <= 11)
    add("mid", "ti-parachute", `PER peu rentable à ${pc(R.tmi, 0)} de TMI`,
      `Chaque euro versé n'économise que ${pc(R.tmi, 0)} d'impôt, alors que la sortie sera imposée au barème et les fonds bloqués jusqu'à la retraite.`,
      perGain, `Privilégier le PEA (${eur(150000 - peaUsed)} de plafond libre) pour les nouveaux versements ; garder le PER pour les années à TMI 30 %.`)
  else
    add("high", "ti-parachute", "Saturer le plafond PER",
      `${eur(perRoom)} de plafond encore disponible cette année, reportable 3 ans.`, perGain,
      `Un versement de ${eur(perRoom)} avant le 31 décembre réduit l'impôt de ${eur(perGain)}.`)

  const seuil30 = BRACKETS[1][0] * R.parts
  add("info", "ti-stairs-up", "Marge avant la tranche à 30 %",
    `Votre revenu imposable est de ${eur(R.rni)} ; la tranche à 30 % commence à ${eur(seuil30)} pour ${R.parts.toLocaleString("fr-FR")} parts.`,
    0, `Marge de ${eur(Math.max(0, seuil30 - R.rni))} : une prime ou un revenu exceptionnel jusqu'à ce montant reste imposé à ${pc(R.tmi, 0)}.`)

  add("mid", "ti-heart-handshake", "Dons aux associations",
    `Réduction de 66 % des versements, dans la limite de 20 % du revenu imposable (${eur(R.rni * P.donCapPct)}).`,
    gainOf({ dons: Math.max(R.s.dons, Math.min(1000, R.rni * P.donCapPct)) }),
    `Vous déclarez ${eur(R.s.dons)} : chaque 100 € supplémentaires rendent 66 € d'impôt.`)

  if (!R.s.domicile) {
    const g = gainOf({ domicile: 2500 })
    add("mid", "ti-home-cog", "Services à la personne non utilisés",
      `Ménage, jardinage, soutien scolaire : crédit d'impôt de 50 % jusqu'à ${eur(P.domCap)} de dépenses, même sans impôt à payer.`,
      g, `Un intervenant déclaré 2 h par semaine (~2 500 €/an) rend ${eur(g)} de crédit d'impôt.`)
  }
  if (R.s.youngKids > 0 && !R.s.garde)
    add("mid", "ti-baby-carriage", "Frais de garde des jeunes enfants",
      `Crédit de 50 % des frais de crèche ou de garde, plafonnés à ${eur(P.gardeCap)} par enfant de moins de 6 ans.`,
      gainOf({ garde: P.gardeCap * R.s.youngKids }), "À renseigner dans la situation fiscale si des frais ont été engagés.")

  if (R.qfCapped > 0)
    add("info", "ti-users", "Avantage familial plafonné",
      `Le gain lié aux personnes à charge est écrêté de ${eur(R.qfCapped)}.`, 0,
      "Vérifier l'intérêt du rattachement d'un enfant majeur plutôt que de la demi-part.")

  if (!R.s.couple) {
    const commun = compute({ couple: true })
    const gain = R.irNet - commun.irNet
    add(gain > 0 ? "high" : "info", "ti-heart", gain > 0 ? "Imposition commune plus favorable" : "Imposition séparée déjà optimale",
      `Deux déclarations séparées produisent ${eur(R.irNet)} d'impôt, contre ${eur(commun.irNet)} en imposition commune.`,
      Math.max(0, gain), gain > 0 ? "Un PACS ou un mariage aligne les revenus sur un seul foyer fiscal." : "Conserver les déclarations séparées.")
  } else if (inp.salaries.length > 1) {
    const sep = compute({ couple: false })
    if (sep.irNet < R.irNet)
      add("info", "ti-heart", "Imposition séparée théoriquement moins chère",
        "Cas rare, dû à l'écart de revenus faible entre les deux membres.", R.irNet - sep.irNet,
        "À examiner avec un conseil avant toute décision — d'autres effets (prestations, PS) entrent en jeu.")
    else
      add("good", "ti-heart", "Imposition commune bien orientée",
        `Le foyer commun économise ${eur(sep.irNet - R.irNet)} par rapport à deux déclarations séparées.`, 0, "Rien à changer.")
  }

  if (R.s.dividendes > 0)
    add("mid", "ti-chart-candle", "Dividendes imposés au CTO",
      `${eur(R.s.dividendes)} de dividendes supportent 30 % de prélèvement forfaitaire (${eur(R.s.dividendes * 0.3)}).`,
      R.s.dividendes * (0.3 - P.ps), "Les mêmes titres logés dans le PEA ne subiraient que 17,2 % de prélèvements sociaux, à la sortie seulement.")

  add("info", "ti-calendar-dollar", "Prélèvement à la source",
    `Taux calculé : ${pc(R.pasRate)}, soit environ ${eur(R.irNet / 12)} par mois.`, 0,
    inp.salaries.length > 1
      ? "Le taux individualisé n'apporte rien ici : les revenus des deux membres sont proches."
      : "Vérifier le taux appliqué par l'employeur sur la fiche de paie.")

  A.sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0))
  return { list: A, totalGain: A.reduce((s, a) => s + (a.gain ?? 0), 0) }
}

export interface Scenario { label: string; result: TaxResult; diff: number }

export function taxScenarios(inp: TaxInputs, R: TaxResult): Scenario[] {
  const defs: [string, Partial<TaxSituation>][] = [
    ["Situation actuelle", {}],
    ["Régime foncier réel", { foncier: "reel" }],
    ["Micro-foncier", { foncier: "micro" }],
    [`${eur(P.deficitCap)} de travaux locatifs`, { travaux: P.deficitCap }],
    ["1 000 € de dons", { dons: 1000 }],
    ["2 500 € de services à domicile", { domicile: 2500 }],
    ["Plafond PER saturé", { perExtra: Math.max(0, R.plafondPer - R.perVerse) }],
  ]
  return defs.map(([label, over]) => {
    const result = computeTax(inp, R.s, over)
    return { label, result, diff: result.totalPrel - R.totalPrel }
  })
}

export interface TaxContextNumbers {
  taxeFonciere: number
  ifiBase: number
  exonere: number
}

export function taxContextNumbers(ctx: FinanceContext): TaxContextNumbers {
  const taxeFonciere = ctx.properties.reduce((s, p) => s + p.value * 0.008, 0)
  const immo = ctx.properties.reduce((s, p) => s + p.value, 0)
  const ifiBase = immo - ctx.loans.filter((l) => l.propertyId).reduce((s, l) => s + l.left, 0)
  const exonere = ctx.savingsBalance * 0.025
  return { taxeFonciere, ifiBase, exonere }
}
