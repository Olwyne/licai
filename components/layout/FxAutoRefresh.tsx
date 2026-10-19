"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

const KEY = "licai-fx-auto-check"
const EVERY_MS = 30 * 60 * 1000

// Mise à jour automatique des taux de change et des cryptos : si le foyer l'a activée, le serveur rafraîchit les taux de plus de 6 h.
// Ce composant ne fait qu'un contrôle par session de navigation et toutes les 30 min.
export function FxAutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    let last = 0
    try { last = Number(sessionStorage.getItem(KEY) ?? 0) } catch { /* stockage indisponible */ }
    if (Date.now() - last < EVERY_MS) return
    try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* stockage indisponible */ }
    fetch("/api/market/fx/refresh", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { refreshed?: boolean } } | null) => { if (j?.data?.refreshed) router.refresh() })
      .catch(() => {})
  }, [router])
  return null
}
