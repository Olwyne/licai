"use client"
import type { CtxHolding } from "@/lib/finance/types"
import type { ProfileKey, QuoteOverrides } from "@/lib/finance/invest"

// Cours : base (stockée) · saisie manuelle · fournisseur externe — préférences conservées dans le navigateur.

export type QuoteMode = "demo" | "manual" | "api"
export interface QuoteState {
  mode: QuoteMode
  manual: Record<string, number>
  api: { endpoint: string; key: string }
  live: QuoteOverrides | null
  ts: string
  status: string
}

const K = { mode: "licai-quote-mode", manual: "licai-quote-manual", api: "licai-quote-api", live: "licai-quote-live", ts: "licai-quote-ts", profile: "licai-profile" }

const read = <T,>(key: string, def: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : def } catch { return def }
}
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* stockage indisponible */ } }

export function loadQuotes(): QuoteState {
  const mode = read<QuoteMode>(K.mode, "demo")
  return {
    mode: ["demo", "manual", "api"].includes(mode) ? mode : "demo",
    manual: read<Record<string, number>>(K.manual, {}),
    api: read(K.api, { endpoint: "", key: "" }),
    live: read<QuoteOverrides | null>(K.live, null),
    ts: read<string>(K.ts, ""),
    status: "",
  }
}

export function saveQuotes(q: QuoteState): void {
  write(K.mode, q.mode); write(K.manual, q.manual); write(K.api, q.api); write(K.live, q.live); write(K.ts, q.ts)
}

export function overrides(q: QuoteState): QuoteOverrides {
  if (q.mode === "manual") return Object.fromEntries(Object.entries(q.manual).map(([k, v]) => [k, { price: v }]))
  if (q.mode === "api" && q.live) return q.live
  return {}
}

export async function refreshLive(q: QuoteState, tickers: string[]): Promise<QuoteState> {
  if (!q.api.endpoint) return { ...q, status: "Aucun fournisseur configuré" }
  try {
    const url = q.api.endpoint + (q.api.endpoint.includes("?") ? "&" : "?") + "symbols=" + encodeURIComponent(tickers.join(","))
    const res = await fetch(url, q.api.key ? { headers: { Authorization: "Bearer " + q.api.key } } : undefined)
    if (!res.ok) throw new Error("HTTP " + res.status)
    const live = (await res.json()) as QuoteOverrides
    return { ...q, live, ts: new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }), status: "Cours reçus du fournisseur" }
  } catch (e) {
    return { ...q, status: `Échec de la requête (${(e as Error).message}) — cours enregistrés conservés` }
  }
}

export const quoteTickers = (holdings: CtxHolding[]): string[] =>
  [...new Set(holdings.filter((h) => h.cls !== "euro" && h.cls !== "monetaire").map((h) => h.tk))]

export const srcLabel = (m: QuoteMode): string =>
  m === "demo" ? "Cours enregistrés" : m === "manual" ? "Cours saisis manuellement" : "Fournisseur externe"

export function loadProfile(): ProfileKey {
  const p = read<string>(K.profile, "equilibre")
  return p === "prudent" || p === "dynamique" ? p : "equilibre"
}
export const saveProfile = (p: ProfileKey) => write(K.profile, p)
