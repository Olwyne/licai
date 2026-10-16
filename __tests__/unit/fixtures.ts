import type { FinanceContext } from "@/lib/finance/types"

// Foyer de test : 2 adultes (2 400 € et 2 050 €/mois), 1 enfant, 1 résidence principale, 1 locatif, enveloppes AV/PEA/CTO/PER.
export const ctx: FinanceContext = {
  year: 2026, month: 6,
  members: [
    { id: "s", name: "Sophie Lambert", short: "Sophie", role: "Admin", color: "#1D9E75", incomeMonthly: 2400, birthYear: 1988, isChild: false },
    { id: "t", name: "Thomas Roux", short: "Thomas", role: "Membre", color: "#378ADD", incomeMonthly: 2050, birthYear: 1985, isChild: false },
    { id: "l", name: "Léa Lambert", short: "Léa", role: "Enfant", color: "#7C6BD6", incomeMonthly: 0, birthYear: 2022, isChild: true },
  ],
  cash: [
    { id: "c1", name: "Joint", type: "checking", currency: "EUR", native: 10000, balance: 10000, ownerIds: ["s", "t"] },
    { id: "c2", name: "Livret", type: "savings", currency: "EUR", native: 6000, balance: 6000, ownerIds: ["s"] },
  ],
  properties: [
    { id: "p1", name: "Lyon 3e", city: "Lyon", type: "principale", value: 280000, price: 240000, rentMonthly: 0, estimatedAt: "2025-01-01", estimateSource: "Agence", costs: { copro: 0, taxe: 900, assur: 0, gestion: 0, travaux: 0, vacance: 0, notaire: 0 }, surface: 78, shares: { s: 50, t: 50 } },
    { id: "p2", name: "Studio", city: "Villeurbanne", type: "locatif", value: 130000, price: 110000, rentMonthly: 640, estimatedAt: "2026-05-01", estimateSource: "Notaire", costs: { copro: 600, taxe: 800, assur: 150, gestion: 400, travaux: 200, vacance: 5, notaire: 8000 }, surface: 24, shares: { s: 100 } },
  ],
  loans: [
    { id: "l1", name: "Immo", kind: "immobilier", left: 142000, monthly: 890, rate: 2.1, propertyId: "p1", endDate: "2044-06" },
    { id: "l2", name: "Studio", kind: "immobilier", left: 74000, monthly: 430, rate: 1.9, propertyId: "p2", endDate: "2041-09" },
    { id: "l3", name: "Auto", kind: "auto", left: 3800, monthly: 320, rate: 4.5, propertyId: null, endDate: "2027-03" },
  ],
  invAccounts: [
    { id: "av", kind: "av", name: "AV", bank: "X", ownerIds: ["s"], benefIds: ["t", "l"], since: 2019, paid: 20000, monthly: 250, fees: 0.5, match: 0 },
    { id: "pea", kind: "pea", name: "PEA", bank: "X", ownerIds: ["s"], benefIds: [], since: 2024, paid: 15000, monthly: 300, fees: 0, match: 0 },
    { id: "cto", kind: "cto", name: "CTO", bank: "X", ownerIds: ["t"], benefIds: [], since: 2020, paid: 10000, monthly: 100, fees: 0, match: 0 },
    { id: "per", kind: "per", name: "PER", bank: "X", ownerIds: ["s"], benefIds: [], since: 2021, paid: 8000, monthly: 150, fees: 0.6, match: 0 },
    { id: "pee", kind: "pee", name: "PEE", bank: "X", ownerIds: ["t"], benefIds: [], since: 2025, paid: 3000, monthly: 100, fees: 1.1, match: 60 },
    { id: "cry", kind: "crypto", name: "Crypto", bank: "X", ownerIds: ["s"], benefIds: [], since: 2021, paid: 4000, monthly: 0, fees: 0, match: 0 },
  ],
  holdings: [
    { id: "h1", acct: "av", name: "Fonds euro", tk: "EURO", cls: "euro", zone: "Zone euro", sector: "Diversifié", cur: "EUR", cap: "—", qty: 18000, pru: 1, price: 1, prev: 1, ter: 0.5, gain: 1400 },
    { id: "h2", acct: "av", name: "MSCI World", tk: "IWDA", cls: "actions", zone: "Monde", sector: "Diversifié", cur: "USD", cap: "Grandes", qty: 100, pru: 90, price: 114, prev: 113, ter: 0.2, gain: null },
    { id: "h3", acct: "pea", name: "CAC 40", tk: "CAC", cls: "actions", zone: "France", sector: "Diversifié", cur: "EUR", cap: "Grandes", qty: 90, pru: 74, price: 87, prev: 86, ter: 0.25, gain: null },
    { id: "h4", acct: "pea", name: "LVMH", tk: "MC", cls: "actions", zone: "France", sector: "Luxe", cur: "EUR", cap: "Grandes", qty: 20, pru: 600, price: 580, prev: null, ter: 0, gain: null },
    { id: "h5", acct: "cto", name: "Apple", tk: "AAPL", cls: "actions", zone: "États-Unis", sector: "Technologie", cur: "USD", cap: "Grandes", qty: 40, pru: 168, price: 230, prev: 229, ter: 0, gain: null },
    { id: "h6", acct: "cto", name: "ASML", tk: "ASML", cls: "actions", zone: "Europe", sector: "Technologie", cur: "EUR", cap: "Grandes", qty: 6, pru: 620, price: 810, prev: 820, ter: 0, gain: null },
    { id: "h7", acct: "per", name: "Fonds PER", tk: "PERF", cls: "euro", zone: "Zone euro", sector: "Diversifié", cur: "EUR", cap: "—", qty: 6000, pru: 1, price: 1, prev: 1, ter: 0.6, gain: 280 },
    { id: "h8", acct: "pee", name: "FCPE", tk: "FCPE", cls: "actions", zone: "Monde", sector: "Diversifié", cur: "EUR", cap: "Grandes", qty: 300, pru: 17, price: 20, prev: 19.9, ter: 1.1, gain: null },
    { id: "h9", acct: "cry", name: "Bitcoin", tk: "BTC", cls: "crypto", zone: "Monde", sector: "Crypto", cur: "USD", cap: "—", qty: 0.05, pru: 51000, price: 74500, prev: 72900, ter: 0, gain: null },
    { id: "h10", acct: "av", name: "SCI", tk: "SCI", cls: "immobilier", zone: "Zone euro", sector: "Immobilier", cur: "EUR", cap: "—", qty: 20, pru: 205, price: 214, prev: 214, ter: 0.85, gain: null },
  ],
  monthlySpend: 3800, savingsBalance: 6000, taxSituation: {}, fx: { EUR: 1, USD: 0.882 }, fxSource: "demo", fxTs: "",
  flows: [],
  history: [{ ym: "2026-01", value: 100000, bench: 100 }, { ym: "2026-06", value: 110000, bench: 109 }],
}
