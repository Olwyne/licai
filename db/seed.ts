import { db } from "@/lib/db"
import {
  members, banks, accounts, categories, transactions,
  budgets, recurring, alerts,
} from "@/db/schema"
import { randomUUID } from "crypto"

export function seedDemoData(householdId: string): void {
  const now = new Date()

  // Members
  const sophieId = randomUUID()
  const thomasId = randomUUID()
  const leaId = randomUUID()
  db.insert(members).values([
    { id: sophieId, householdId, name: "Sophie Lambert", short: "Sophie", role: "Administratrice", colorHex: "#1D9E75", monthlyIncomeCents: 240000, birthYear: 1988, retireYear: 2052 },
    { id: thomasId, householdId, name: "Thomas Roux", short: "Thomas", role: "Membre", colorHex: "#378ADD", monthlyIncomeCents: 205000, birthYear: 1985, retireYear: 2049 },
    { id: leaId, householdId, name: "Léa Lambert", short: "Léa", role: "Enfant (lecture)", colorHex: "#7C6BD6", monthlyIncomeCents: 0, birthYear: 2016 },
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

  // Transactions — 18 entries from prototype data.js (amounts converted to cents)
  const txData = [
    { name: "Carrefour",             cat: "food",      amountCents: -6400,   date: "2026-06-01", note: "Courses de la semaine" },
    { name: "Salaire juin",          cat: "income",    amountCents: 210000,  date: "2026-06-01", note: "Virement employeur" },
    { name: "Loyer",                 cat: "home",      amountCents: -78000,  date: "2026-06-01", note: "Appartement Lyon 3e" },
    { name: "Spotify",               cat: "leisure",   amountCents: -1099,   date: "2026-05-31", note: "Abonnement Premium" },
    { name: "SNCF — Paris-Lyon",     cat: "transport", amountCents: -4200,   date: "2026-05-30", note: "Aller-retour week-end" },
    { name: "Mission freelance",     cat: "income",    amountCents: 30000,   date: "2026-05-30", note: "Design landing page" },
    { name: "Pharmacie",             cat: "health",    amountCents: -1800,   date: "2026-05-29", note: "" },
    { name: "Zara",                  cat: "shopping",  amountCents: -8900,   date: "2026-05-28", note: "Veste été" },
    { name: "Boulangerie Paul",      cat: "food",      amountCents: -740,    date: "2026-05-28", note: "" },
    { name: "Cinéma Pathé",          cat: "leisure",   amountCents: -2400,   date: "2026-05-27", note: "2 places" },
    { name: "Uber",                  cat: "transport", amountCents: -1650,   date: "2026-05-26", note: "" },
    { name: "Monoprix",              cat: "food",      amountCents: -3820,   date: "2026-05-25", note: "" },
    { name: "EDF",                   cat: "home",      amountCents: -6200,   date: "2026-05-24", note: "Électricité mai" },
    { name: "Décathlon",             cat: "shopping",  amountCents: -5400,   date: "2026-05-23", note: "Chaussures running" },
    { name: "Restaurant Le Bouchon", cat: "food",      amountCents: -4700,   date: "2026-05-22", note: "Dîner entre amis" },
    { name: "Essence Total",         cat: "transport", amountCents: -5800,   date: "2026-05-21", note: "" },
    { name: "Netflix",               cat: "leisure",   amountCents: -1349,   date: "2026-05-20", note: "Abonnement" },
    { name: "Mutuelle santé",        cat: "health",    amountCents: -3400,   date: "2026-05-19", note: "Cotisation mensuelle" },
  ]
  for (const t of txData) {
    db.insert(transactions).values({
      id: randomUUID(), householdId, accountId: acctJointId,
      categoryId: cats[t.cat], name: t.name, amountCents: t.amountCents,
      date: t.date, note: t.note, isCommon: true, createdAt: now,
    }).run()
  }

  // Budgets for current month (2026-06)
  const budgetDefs = [
    { cat: "food",      limitCents: 40000 },
    { cat: "home",      limitCents: 85000 },
    { cat: "transport", limitCents: 18000 },
    { cat: "leisure",   limitCents: 15000 },
    { cat: "shopping",  limitCents: 20000 },
    { cat: "health",    limitCents: 10000 },
  ]
  for (const b of budgetDefs) {
    db.insert(budgets).values({ id: randomUUID(), householdId, categoryId: cats[b.cat], limitCents: b.limitCents, month: "2026-06" }).run()
  }

  // Recurring charges — 8 items from prototype data.js
  const recDefs = [
    { name: "Netflix",              cat: "leisure",   amountCents: 1349,  frequency: "monthly"   as const, kind: "subscription" as const, nextDate: "2026-07-20", accountId: acctRevId },
    { name: "Spotify Famille",      cat: "leisure",   amountCents: 1799,  frequency: "monthly"   as const, kind: "subscription" as const, nextDate: "2026-07-31", accountId: acctJointId },
    { name: "Mutuelle santé",       cat: "health",    amountCents: 6800,  frequency: "monthly"   as const, kind: "charge"       as const, nextDate: "2026-07-05", accountId: acctJointId },
    { name: "EDF — mensualisation", cat: "home",      amountCents: 7450,  frequency: "monthly"   as const, kind: "charge"       as const, nextDate: "2026-07-04", accountId: acctJointId },
    { name: "Internet + mobile",    cat: "home",      amountCents: 4999,  frequency: "monthly"   as const, kind: "charge"       as const, nextDate: "2026-07-15", accountId: acctJointId },
    { name: "Virement épargne",     cat: "income",    amountCents: 40000, frequency: "monthly"   as const, kind: "saving"       as const, nextDate: "2026-07-02", accountId: acctSophieId },
    { name: "Assurance habitation", cat: "home",      amountCents: 18900, frequency: "annual"    as const, kind: "charge"       as const, nextDate: "2026-09-12", accountId: acctJointId },
    { name: "Assurance auto",       cat: "transport", amountCents: 12600, frequency: "quarterly" as const, kind: "charge"       as const, nextDate: "2026-07-08", accountId: acctThomasId },
  ]
  for (const r of recDefs) {
    db.insert(recurring).values({
      id: randomUUID(), householdId, accountId: r.accountId, categoryId: cats[r.cat],
      name: r.name, amountCents: r.amountCents, frequency: r.frequency, kind: r.kind,
      nextDate: r.nextDate, active: true, createdAt: now,
    }).run()
  }

  // Alerts — a few demo notifications
  db.insert(alerts).values([
    {
      id: randomUUID(), householdId,
      kind: "budget",
      title: "Budget Loisirs dépassé",
      body: "Vous avez dépensé 210 € sur un budget de 150 € en Loisirs ce mois-ci.",
      tone: "warning",
      date: "2026-06-01",
      resolved: false,
    },
    {
      id: randomUUID(), householdId,
      kind: "budget",
      title: "Budget Logement presque atteint",
      body: "842 € dépensés sur 850 € de budget Logement — il reste 8 €.",
      tone: "danger",
      date: "2026-06-01",
      resolved: false,
    },
    {
      id: randomUUID(), householdId,
      kind: "echeance",
      title: "Prélèvement à venir — Mutuelle santé",
      body: "68 € seront prélevés le 5 juillet sur le Compte joint.",
      tone: "info",
      date: "2026-06-28",
      resolved: false,
    },
  ]).run()
}
