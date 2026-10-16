import { db } from "@/lib/db"
import {
  members, banks, accounts, categories, transactions,
  budgets, recurring, alerts, goals, properties, propertyOwners, loans, investments, investmentAccounts, portfolioSnapshots, investmentFlows, contracts,
} from "@/db/schema"
import { randomUUID } from "crypto"
import { fxRate } from "@/lib/finance/invest"

export function seedDemoData(householdId: string): void {
  const now = new Date()

  // Members
  const sophieId = randomUUID()
  const thomasId = randomUUID()
  const leaId = randomUUID()
  db.insert(members).values([
    { id: sophieId, householdId, name: "Sophie Lambert", short: "Sophie", role: "Administratrice", colorHex: "#1D9E75", monthlyIncomeCents: 240000, birthYear: 1988, retireYear: 2052 },
    { id: thomasId, householdId, name: "Thomas Roux", short: "Thomas", role: "Membre", colorHex: "#378ADD", monthlyIncomeCents: 205000, birthYear: 1985, retireYear: 2049 },
    { id: leaId, householdId, name: "Léa Lambert", short: "Léa", role: "Enfant (lecture)", colorHex: "#7C6BD6", monthlyIncomeCents: 0, birthYear: 2016, isChild: true, allowanceCents: 5000 },
  ]).run()

  // Banks
  const bnpId = randomUUID()
  const revId = randomUUID()
  const boursoId = randomUUID()
  const caId = randomUUID()
  db.insert(banks).values([
    { id: bnpId, householdId, name: "BNP Paribas", colorHex: "#1D9E75", csvSeparator: ";", csvDecimal: ",", csvDateFormat: "DD/MM/YYYY" },
    { id: revId, householdId, name: "Revolut", colorHex: "#378ADD", csvSeparator: ",", csvDecimal: ".", csvDateFormat: "YYYY-MM-DD" },
    { id: boursoId, householdId, name: "BoursoBank", colorHex: "#D4537E", csvSeparator: ";", csvDecimal: ",", csvDateFormat: "DD/MM/YYYY" },
    { id: caId, householdId, name: "Crédit Agricole", colorHex: "#EF9F27", csvSeparator: ";", csvDecimal: ",", csvDateFormat: "DD/MM/YYYY" },
  ]).run()

  // Accounts
  const acctJointId = randomUUID()
  const acctSophieId = randomUUID()
  const acctLddId = randomUUID()
  const acctRevId = randomUUID()
  const acctThomasId = randomUUID()
  const acctLeaId = randomUUID()
  db.insert(accounts).values([
    { id: acctJointId, householdId, bankId: bnpId, name: "Compte joint", type: "checking", balanceCents: 238000, currency: "EUR", ownerIds: JSON.stringify([sophieId, thomasId]) },
    { id: acctSophieId, householdId, bankId: bnpId, name: "Compte courant", type: "checking", balanceCents: 114000, currency: "EUR", ownerIds: JSON.stringify([sophieId]) },
    { id: acctLddId, householdId, bankId: bnpId, name: "Livret développement durable", type: "savings", balanceCents: 600000, currency: "EUR", ownerIds: JSON.stringify([sophieId, thomasId]) },
    { id: acctRevId, householdId, bankId: revId, name: "Revolut perso", type: "checking", balanceCents: 31000, currency: "EUR", ownerIds: JSON.stringify([sophieId]) },
    { id: acctThomasId, householdId, bankId: boursoId, name: "Compte courant", type: "checking", balanceCents: 89000, currency: "EUR", ownerIds: JSON.stringify([thomasId]) },
    { id: acctLeaId, householdId, bankId: caId, name: "Livret jeune", type: "savings", balanceCents: 48000, currency: "EUR", ownerIds: JSON.stringify([leaId]) },
  ]).run()

  // System categories
  const cats: Record<string, string> = {}
  const catDefs = [
    { key: "food",      label: "Alimentation", icon: "ti-basket",        colorHex: "#1D9E75" },
    { key: "home",      label: "Logement",      icon: "ti-home",          colorHex: "#888780" },
    { key: "transport", label: "Transport",     icon: "ti-train",         colorHex: "#378ADD" },
    { key: "leisure",   label: "Loisirs",       icon: "ti-device-tv",     colorHex: "#7C6BD6" },
    { key: "shopping",  label: "Shopping",      icon: "ti-shirt",         colorHex: "#D4537E" },
    { key: "health",    label: "Santé",         icon: "ti-pill",          colorHex: "#D85A30" },
    { key: "income",    label: "Revenu",        icon: "ti-building-bank", colorHex: "#1D9E75" },
  ]
  for (const c of catDefs) {
    cats[c.key] = randomUUID()
    db.insert(categories).values({ id: cats[c.key], householdId, label: c.label, icon: c.icon, colorHex: c.colorHex, isSystem: true }).run()
  }

  // Build relative dates: current month (cm) and previous month (pm)
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const pmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const pm = `${pmDate.getFullYear()}-${String(pmDate.getMonth() + 1).padStart(2, "0")}`
  const d = (ym: string, day: number) => `${ym}-${String(day).padStart(2, "0")}`

  // Transactions — 18 entries from prototype data.js (amounts converted to cents)
  const txData = [
    { name: "Carrefour",             cat: "food",      amountCents: -6400,   date: d(cm, 1),  note: "Courses de la semaine" },
    { name: `Salaire ${now.toLocaleString("fr-FR", { month: "long" })}`, cat: "income", amountCents: 210000, date: d(cm, 1), note: "Virement employeur" },
    { name: "Loyer",                 cat: "home",      amountCents: -78000,  date: d(cm, 1),  note: "Appartement Lyon 3e" },
    { name: "Spotify",               cat: "leisure",   amountCents: -1099,   date: d(cm, 2),  note: "Abonnement Premium" },
    { name: "SNCF — Paris-Lyon",     cat: "transport", amountCents: -4200,   date: d(cm, 5),  note: "Aller-retour week-end" },
    { name: "Mission freelance",     cat: "income",    amountCents: 30000,   date: d(cm, 7),  note: "Design landing page" },
    { name: "Pharmacie",             cat: "health",    amountCents: -1800,   date: d(cm, 8),  note: "" },
    { name: "Zara",                  cat: "shopping",  amountCents: -8900,   date: d(cm, 10), note: "Veste été" },
    { name: "Boulangerie Paul",      cat: "food",      amountCents: -740,    date: d(cm, 11), note: "" },
    { name: "Cinéma Pathé",          cat: "leisure",   amountCents: -2400,   date: d(cm, 13), note: "2 places" },
    { name: "Uber",                  cat: "transport", amountCents: -1650,   date: d(cm, 14), note: "" },
    { name: "Monoprix",              cat: "food",      amountCents: -3820,   date: d(pm, 25), note: "" },
    { name: "EDF",                   cat: "home",      amountCents: -6200,   date: d(pm, 24), note: `Électricité ${pmDate.toLocaleString("fr-FR", { month: "long" })}` },
    { name: "Décathlon",             cat: "shopping",  amountCents: -5400,   date: d(pm, 23), note: "Chaussures running" },
    { name: "Restaurant Le Bouchon", cat: "food",      amountCents: -4700,   date: d(pm, 22), note: "Dîner entre amis" },
    { name: "Essence Total",         cat: "transport", amountCents: -5800,   date: d(pm, 21), note: "" },
    { name: "Netflix",               cat: "leisure",   amountCents: -1349,   date: d(pm, 20), note: "Abonnement" },
    { name: "Mutuelle santé",        cat: "health",    amountCents: -3400,   date: d(pm, 19), note: "Cotisation mensuelle" },
  ]
  for (const t of txData) {
    db.insert(transactions).values({
      id: randomUUID(), householdId, accountId: acctJointId,
      categoryId: cats[t.cat], name: t.name, amountCents: t.amountCents,
      date: t.date, note: t.note, isCommon: true, createdAt: now,
    }).run()
  }

  // Budgets for current month (dynamic)
  const budgetDefs = [
    { cat: "food",      limitCents: 40000 },
    { cat: "home",      limitCents: 85000 },
    { cat: "transport", limitCents: 18000 },
    { cat: "leisure",   limitCents: 15000 },
    { cat: "shopping",  limitCents: 20000 },
    { cat: "health",    limitCents: 10000 },
  ]
  for (const b of budgetDefs) {
    db.insert(budgets).values({ id: randomUUID(), householdId, categoryId: cats[b.cat], limitCents: b.limitCents, month: cm }).run()
  }

  // Build next month date string for recurring items
  const nmDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nm = `${nmDate.getFullYear()}-${String(nmDate.getMonth() + 1).padStart(2, "0")}`
  const n2mDate = new Date(now.getFullYear(), now.getMonth() + 2, 1)
  const n2m = `${n2mDate.getFullYear()}-${String(n2mDate.getMonth() + 1).padStart(2, "0")}`

  // Recurring charges — 8 items from prototype data.js
  const recDefs = [
    { name: "Netflix",              cat: "leisure",   amountCents: 1349,  frequency: "monthly"   as const, kind: "subscription" as const, nextDate: `${nm}-20`,  accountId: acctRevId },
    { name: "Spotify Famille",      cat: "leisure",   amountCents: 1799,  frequency: "monthly"   as const, kind: "subscription" as const, nextDate: `${nm}-28`,  accountId: acctJointId },
    { name: "Mutuelle santé",       cat: "health",    amountCents: 6800,  frequency: "monthly"   as const, kind: "charge"       as const, nextDate: `${nm}-05`,  accountId: acctJointId },
    { name: "EDF — mensualisation", cat: "home",      amountCents: 7450,  frequency: "monthly"   as const, kind: "charge"       as const, nextDate: `${nm}-04`,  accountId: acctJointId },
    { name: "Internet + mobile",    cat: "home",      amountCents: 4999,  frequency: "monthly"   as const, kind: "charge"       as const, nextDate: `${nm}-15`,  accountId: acctJointId },
    { name: "Virement épargne",     cat: "income",    amountCents: 40000, frequency: "monthly"   as const, kind: "saving"       as const, nextDate: `${nm}-02`,  accountId: acctSophieId },
    { name: "Assurance habitation", cat: "home",      amountCents: 18900, frequency: "annual"    as const, kind: "charge"       as const, nextDate: `${n2m}-12`, accountId: acctJointId },
    { name: "Assurance auto",       cat: "transport", amountCents: 12600, frequency: "quarterly" as const, kind: "charge"       as const, nextDate: `${nm}-08`,  accountId: acctThomasId },
  ]
  for (const r of recDefs) {
    db.insert(recurring).values({
      id: randomUUID(), householdId, accountId: r.accountId, categoryId: cats[r.cat],
      name: r.name, amountCents: r.amountCents, frequency: r.frequency, kind: r.kind,
      nextDate: r.nextDate, active: true, createdAt: now,
    }).run()
  }

  // Goals
  db.insert(goals).values([
    { id: randomUUID(), householdId, name: "Voyage au Japon", emoji: "✈️", targetCents: 350000, currentCents: 127000, deadline: `${n2m}-15`, kind: "court", colorHex: "#378ADD", createdAt: now },
    { id: randomUUID(), householdId, name: "Apport immobilier", emoji: "🏠", targetCents: 5000000, currentCents: 1240000, deadline: null, kind: "long", colorHex: "#1D9E75", createdAt: now },
    { id: randomUUID(), householdId, name: "Fonds d'urgence", emoji: "🛡️", targetCents: 600000, currentCents: 600000, deadline: null, kind: "court", colorHex: "#7C6BD6", createdAt: now },
    { id: randomUUID(), householdId, name: "Console de jeux", emoji: "🎮", targetCents: 50000, currentCents: 34000, deadline: null, kind: "court", colorHex: "#EF9F27", memberId: leaId, linkedAccountId: acctLeaId, createdAt: now },
    { id: randomUUID(), householdId, name: "Voyage scolaire", emoji: "🎒", targetCents: 80000, currentCents: 14000, deadline: `${n2m}-01`, kind: "court", colorHex: "#D4537E", memberId: leaId, linkedAccountId: acctLeaId, createdAt: now },
  ]).run()

  // Properties
  const lyonId = randomUUID()
  const studioId = randomUUID()
  db.insert(properties).values([
    { id: lyonId, householdId, name: "Appartement Lyon 3e", kind: "immobilier", valueCents: 28000000, purchasePriceCents: 24000000, purchaseDate: "2019-06-15", note: "Résidence principale", address: "Lyon 3e", surfaceSqm: 78, residenceType: "principale", taxeFonciereCents: 90000, costs: JSON.stringify({ copro: 1200, assur: 180, notaire: 18000 }), createdAt: now },
    { id: studioId, householdId, name: "Studio Villeurbanne", kind: "immobilier", valueCents: 13000000, purchasePriceCents: 11000000, purchaseDate: "2021-09-01", note: "Locatif meublé", address: "Villeurbanne", surfaceSqm: 24, residenceType: "locatif", rentMonthlyCents: 64000, taxeFonciereCents: 80000, costs: JSON.stringify({ copro: 600, assur: 150, gestion: 400, travaux: 200, vacance: 5, notaire: 8000 }), createdAt: now },
    { id: randomUUID(), householdId, name: "Renault Clio", kind: "vehicule", valueCents: 850000, purchasePriceCents: 1400000, purchaseDate: "2021-03-10", note: "", createdAt: now },
  ]).run()
  db.insert(propertyOwners).values([
    { id: randomUUID(), propertyId: lyonId, memberId: sophieId, sharePercent: 50 },
    { id: randomUUID(), propertyId: lyonId, memberId: thomasId, sharePercent: 50 },
    { id: randomUUID(), propertyId: studioId, memberId: sophieId, sharePercent: 100 },
  ]).run()

  // Loans
  db.insert(loans).values([
    { id: randomUUID(), householdId, name: "Crédit immobilier", kind: "immobilier", principalCents: 18000000, remainingCents: 14200000, monthlyPaymentCents: 89000, ratePercent: 2.1, endDate: "2044-06-01", propertyId: lyonId, note: "BNP Paribas", createdAt: now },
    { id: randomUUID(), householdId, name: "Crédit studio", kind: "immobilier", principalCents: 9000000, remainingCents: 7400000, monthlyPaymentCents: 43000, ratePercent: 1.9, endDate: "2041-09-01", propertyId: studioId, note: "Crédit Agricole", createdAt: now },
    { id: randomUUID(), householdId, name: "Crédit auto", kind: "auto", principalCents: 1200000, remainingCents: 380000, monthlyPaymentCents: 32000, ratePercent: 4.5, endDate: "2027-03-01", note: "Crédit Agricole", createdAt: now },
  ]).run()

  // Enveloppes de placement + lignes (portées du prototype)
  const A = (kind: string, name: string, bank: string, owners: string[], since: number, paid: number, monthly: number, fees: number, extra: { match?: number; benefs?: string[] } = {}) => {
    const id = randomUUID()
    db.insert(investmentAccounts).values({
      id, householdId, kind, name, bank, ownerIds: JSON.stringify(owners), benefIds: JSON.stringify(extra.benefs ?? []),
      sinceYear: since, paidCents: paid * 100, monthlyCents: monthly * 100, feesPct: fees, matchPct: extra.match ?? 0, createdAt: now,
    }).run()
    return id
  }
  const avLinxea = A("av", "Linxea Spirit 2", "Spirica", [sophieId], 2019, 26400, 250, 0.5, { benefs: [thomasId, leaId] })
  const avBourso = A("av", "Boursorama Vie", "BoursoBank", [thomasId], 2020, 17800, 150, 0.75, { benefs: [sophieId] })
  const peaBourso = A("pea", "PEA BoursoBank", "BoursoBank", [sophieId], 2018, 19600, 300, 0)
  const peaFortuneo = A("pea", "PEA Fortuneo", "Fortuneo", [thomasId], 2021, 15400, 200, 0)
  const peaPme = A("peapme", "PEA-PME Crédit Agricole", "Crédit Agricole", [thomasId], 2022, 3300, 0, 0)
  const ctoDegiro = A("cto", "Compte-titres Degiro", "Degiro", [sophieId], 2020, 15900, 100, 0)
  const perSophie = A("per", "PER Linxea Suravenir", "Suravenir", [sophieId], 2021, 10200, 150, 0.6)
  const perThomas = A("per", "PER Boursorama", "BoursoBank", [thomasId], 2022, 6600, 100, 0.6)
  const peeThomas = A("pee", "PEE — Groupe Sanofi", "Amundi ESR", [thomasId], 2019, 7100, 120, 1.1, { match: 60 })
  const cryptoKra = A("crypto", "Kraken", "Kraken", [sophieId], 2021, 4300, 0, 0)

  // [acct, name, ticker, class, zone, sector, currency, cap, qty, pru, price, prev, ter, gain, kindLegacy]
  const holdings: [string, string, string, string, string, string, string, string, number, number, number, number, number, number | null][] = [
    [avLinxea, "Fonds euro Spirica", "EURO-SPI", "euro", "Zone euro", "Diversifié", "EUR", "—", 18000, 1, 1, 1, 0.5, 1420],
    [avLinxea, "iShares MSCI World", "IWDA", "actions", "Monde", "Diversifié", "USD", "Grandes", 105, 92.4, 114.2, 113.05, 0.2, null],
    [avBourso, "Fonds euro Generali", "EURO-GEN", "euro", "Zone euro", "Diversifié", "EUR", "—", 9000, 1, 1, 1, 0.75, 610],
    [avBourso, "SCI Capimmo", "CAPIMMO", "immobilier", "Zone euro", "Immobilier", "EUR", "—", 21, 205, 214.6, 214.6, 0.85, null],
    [avBourso, "Amundi S&P 500", "500", "actions", "États-Unis", "Diversifié", "USD", "Grandes", 132, 42.1, 49.85, 49.31, 0.15, null],
    [peaBourso, "Amundi MSCI World", "CW8", "actions", "Monde", "Diversifié", "EUR", "Grandes", 23, 468, 612.4, 608.1, 0.38, null],
    [peaBourso, "BNPP S&P 500", "ESE", "actions", "États-Unis", "Diversifié", "EUR", "Grandes", 320, 15.9, 21.35, 21.12, 0.12, null],
    [peaBourso, "Amundi PEA Émergents", "PAEEM", "actions", "Émergents", "Diversifié", "EUR", "Grandes", 92, 24.4, 27.9, 28.15, 0.2, null],
    [peaBourso, "Air Liquide", "AI", "actions", "Europe", "Industrie", "EUR", "Grandes", 18, 158, 178.4, 177.2, 0, null],
    [peaFortuneo, "Amundi CAC 40", "CAC", "actions", "France", "Diversifié", "EUR", "Grandes", 92, 74.2, 87.6, 87.1, 0.25, null],
    [peaFortuneo, "LVMH", "MC", "actions", "France", "Luxe", "EUR", "Grandes", 7, 612, 586.3, 592.4, 0, null],
    [peaFortuneo, "TotalEnergies", "TTE", "actions", "France", "Énergie", "EUR", "Grandes", 48, 54.1, 61.2, 60.4, 0, null],
    [peaFortuneo, "Sanofi", "SAN", "actions", "France", "Santé", "EUR", "Grandes", 24, 88.4, 92.1, 92.8, 0, null],
    [peaPme, "Sycomore Sélection PME", "SYC-PME", "actions", "Europe", "Diversifié", "EUR", "Petites", 34, 96, 101.2, 100.4, 1.9, null],
    [ctoDegiro, "Apple", "AAPL", "actions", "États-Unis", "Technologie", "USD", "Grandes", 22, 168, 231.4, 229.8, 0, null],
    [ctoDegiro, "ASML", "ASML", "actions", "Europe", "Technologie", "EUR", "Grandes", 4, 620, 812, 820, 0, null],
    [ctoDegiro, "Alphabet", "GOOGL", "actions", "États-Unis", "Technologie", "USD", "Grandes", 13, 142, 196.5, 194.2, 0, null],
    [ctoDegiro, "Invesco Nasdaq 100", "EQQQ", "actions", "États-Unis", "Technologie", "USD", "Grandes", 21, 198, 261.4, 259, 0.3, null],
    [ctoDegiro, "iShares € Corp Bond", "IEAC", "obligations", "Zone euro", "Obligations", "EUR", "—", 42, 122, 126.8, 126.5, 0.2, null],
    [perSophie, "Fonds euro Suravenir", "EURO-SUR", "euro", "Zone euro", "Diversifié", "EUR", "—", 6200, 1, 1, 1, 0.6, 285],
    [perSophie, "Amundi MSCI World", "CW8", "actions", "Monde", "Diversifié", "EUR", "Grandes", 9, 512, 612.4, 608.1, 0.38, null],
    [perThomas, "Fonds euro Boursorama", "EURO-BRS", "euro", "Zone euro", "Diversifié", "EUR", "—", 4100, 1, 1, 1, 0.6, 190],
    [perThomas, "Amundi MSCI World", "CW8", "actions", "Monde", "Diversifié", "EUR", "Grandes", 5, 545, 612.4, 608.1, 0.38, null],
    [peeThomas, "FCPE Actions Monde", "FCPE-AM", "actions", "Monde", "Diversifié", "EUR", "Grandes", 340, 17.2, 20.1, 19.95, 1.1, null],
    [peeThomas, "FCPE Monétaire", "FCPE-MO", "monetaire", "Zone euro", "Monétaire", "EUR", "—", 2400, 1, 1, 1, 0.4, 42],
    [cryptoKra, "Bitcoin", "BTC", "crypto", "Monde", "Crypto", "USD", "—", 0.052, 51000, 74500, 72900, 0, null],
    [cryptoKra, "Ethereum", "ETH", "crypto", "Monde", "Crypto", "USD", "—", 0.62, 2450, 2680, 2610, 0, null],
  ]
  const legacyKind = (cls: string, name: string) => (cls === "crypto" ? "crypto" : cls === "euro" || name.startsWith("FCPE") ? "fonds" : name.match(/MSCI|S&P|CAC|Nasdaq|Émergents|Bond|PME/) ? "etf" : "action")
  db.insert(investments).values(holdings.map(([acct, name, tk, cls, zone, sector, cur, cap, qty, pru, price, prev, ter, gain]) => ({
    id: randomUUID(), householdId, name, ticker: tk, kind: legacyKind(cls, name), quantity: qty,
    unitPriceCents: Math.round(price * 100), purchasePriceCents: Math.round(pru * 100), prevPriceCents: Math.round(prev * 100),
    note: "", createdAt: now, accountId: acct, assetClass: cls, zone, sector, currency: cur, cap, terPct: ter,
    gainCents: gain != null ? Math.round(gain * 100) : null,
  }))).run()

  // Historique de valorisation (6 mois) vs indice de référence (base 100 il y a 5 mois)
  const totalNow = holdings.reduce((sum, h) => sum + h[8] * h[10] * fxRate(h[6]), 0)
  const histValues = [134800, 138400, 136100, 142900, 145700, Math.round(totalNow)]
  const histBench = [100, 102.4, 100.9, 105.8, 107.9, 109.6]
  db.insert(portfolioSnapshots).values(histValues.map((v, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { id: randomUUID(), householdId, ym: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, valueCents: v * 100, benchIndex: histBench[i] }
  })).run()

  // Versements du foyer, 6 derniers mois (hors abondement employeur)
  const flowAmounts = [1370, 1370, 2870, 1370, 1370, 1370]
  db.insert(investmentFlows).values(flowAmounts.map((a, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { id: randomUUID(), householdId, ym: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, amountCents: a * 100, matchCents: 7200, note: a > 2000 ? "Versement exceptionnel PEA (1 500 €)" : "" }
  })).run()

  // Contracts (prévoyance)
  db.insert(contracts).values([
    { id: randomUUID(), householdId, name: "Assurance-vie Linxea Spirit 2", insurer: "Linxea", kind: "assurance-vie", valueCents: 1840000, monthlyPremiumCents: 30000, startDate: "2020-04-01", endDate: null, note: "Fonds euros + UC", createdAt: now },
    { id: randomUUID(), householdId, name: "Mutuelle Alan", insurer: "Alan", kind: "sante", valueCents: 0, monthlyPremiumCents: 6800, startDate: "2023-01-01", endDate: null, note: "Formule Éco+", createdAt: now },
    { id: randomUUID(), householdId, name: "PER BNP Paribas", insurer: "BNP Paribas", kind: "retraite", valueCents: 420000, monthlyPremiumCents: 20000, startDate: "2022-09-01", endDate: null, note: "Plan épargne retraite", createdAt: now },
  ]).run()

  // Alerts — a few demo notifications
  db.insert(alerts).values([
    {
      id: randomUUID(), householdId,
      kind: "budget",
      title: "Budget Loisirs dépassé",
      body: "Vous avez dépensé 210 € sur un budget de 150 € en Loisirs ce mois-ci.",
      tone: "warning",
      date: d(cm, 1),
      resolved: false,
    },
    {
      id: randomUUID(), householdId,
      kind: "budget",
      title: "Budget Logement presque atteint",
      body: "842 € dépensés sur 850 € de budget Logement — il reste 8 €.",
      tone: "danger",
      date: d(cm, 1),
      resolved: false,
    },
    {
      id: randomUUID(), householdId,
      kind: "echeance",
      title: "Prélèvement à venir — Mutuelle santé",
      body: `68 € seront prélevés le 5 ${nmDate.toLocaleString("fr-FR", { month: "long" })} sur le Compte joint.`,
      tone: "info",
      date: d(cm, 14),
      resolved: false,
    },
  ]).run()
}
