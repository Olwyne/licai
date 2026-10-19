"use client"
import type { CtxHolding } from "@/lib/finance/types"
import type { ProfileKey, QuoteOverrides } from "@/lib/finance/invest"

// Cours : base (stockée) · saisie manuelle · fournisseur externe — préférences conservées dans le navigateur.

export type QuoteMode = "demo" | "manual" | "api" | "auto"
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
    mode: ["demo", "manual", "api", "auto"].includes(mode) ? mode : "demo",
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
  if ((q.mode === "api" || q.mode === "auto") && q.live) return q.live
  return {}
}

const stamp = () => new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

/** Mode « auto » : cours crypto du jour via le serveur (CoinGecko) ; les autres supports gardent leur cours enregistré. */
export async function refreshAuto(q: QuoteState, holdings: CtxHolding[]): Promise<QuoteState> {
  const crypto = holdings.filter((h) => h.cls === "crypto")
  if (!crypto.length) return { ...q, status: "Aucun support crypto à mettre à jour" }
  try {
    const symbols = [...new Set(crypto.map((h) => `${h.tk}:${h.cur}`))].join(",")
    const res = await fetch("/api/market/quotes?symbols=" + encodeURIComponent(symbols))
    if (!res.ok) throw new Error("HTTP " + res.status)
    const live = ((await res.json()) as { data: QuoteOverrides }).data
    const n = Object.keys(live).length
    return { ...q, live, ts: stamp(), status: n ? `${n} cours crypto mis à jour` : "Aucun cours reçu pour ces supports" }
  } catch (e) {
    return { ...q, status: `Échec de la mise à jour (${(e as Error).message}) — cours enregistrés conservés` }
  }
}

export async function refreshLive(q: QuoteState, tickers: string[]): Promise<QuoteState> {
  if (!q.api.endpoint) return { ...q, status: "Aucun fournisseur configuré" }
  try {
    const url = q.api.endpoint + (q.api.endpoint.includes("?") ? "&" : "?") + "symbols=" + encodeURIComponent(tickers.join(","))
    const res = await fetch(url, q.api.key ? { headers: { Authorization: "Bearer " + q.api.key } } : undefined)
    if (!res.ok) throw new Error("HTTP " + res.status)
    const live = (await res.json()) as QuoteOverrides
    return { ...q, live, ts: stamp(), status: "Cours reçus du fournisseur" }
  } catch (e) {
    return { ...q, status: `Échec de la requête (${(e as Error).message}) — cours enregistrés conservés` }
  }
}

export const quoteTickers = (holdings: CtxHolding[]): string[] =>
  [...new Set(holdings.filter((h) => h.cls !== "euro" && h.cls !== "monetaire").map((h) => h.tk))]

export const srcLabel = (m: QuoteMode): string =>
  m === "demo" ? "Cours enregistrés" : m === "manual" ? "Cours saisis manuellement" : m === "auto" ? "Crypto en direct" : "Fournisseur externe"

export function loadProfile(): ProfileKey {
  const p = read<string>(K.profile, "equilibre")
  return p === "prudent" || p === "dynamique" ? p : "equilibre"
}
export const saveProfile = (p: ProfileKey) => write(K.profile, p)
