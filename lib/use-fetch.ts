"use client"
import { useCallback, useEffect, useState } from "react"

interface Result<T> { key: string; data: T | null; error: string; version: number }

/**
 * Charge une ressource JSON `{ data }` de l'API. Le résultat n'est écrit qu'à l'arrivée de la réponse (jamais de setState
 * synchrone dans l'effet) ; l'ancienne valeur reste affichée pendant un rechargement.
 * `url = null` : rien à charger. `reload()` relance la requête ; `version` augmente à chaque réponse réussie.
 */
export function useFetch<T>(url: string | null, errorMessage = "Impossible de charger les données."): { data: T | null; error: string; loading: boolean; reload: () => void; version: number; setData: (u: T | null | ((prev: T | null) => T | null)) => void } {
  const [tick, setTick] = useState(0)
  const key = `${url}#${tick}`
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: "", version: 0 })

  useEffect(() => {
    if (!url) return
    let live = true
    fetch(url)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
        if (!res.ok || !json || json.error) throw new Error(json?.error ?? errorMessage)
        return json.data as T
      })
      .then((data) => { if (live) setResult((r) => ({ key, data, error: "", version: r.version + 1 })) })
      .catch((e: Error) => { if (live) setResult((r) => ({ ...r, key, error: e instanceof TypeError ? "Erreur réseau." : e.message || errorMessage })) })
    return () => { live = false }
  }, [url, key, errorMessage])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  /** Mise à jour locale (optimiste) de la ressource affichée, avant ou sans rechargement. */
  const setData = useCallback((u: T | null | ((prev: T | null) => T | null)) => {
    setResult((r) => ({ ...r, data: typeof u === "function" ? (u as (prev: T | null) => T | null)(r.data) : u }))
  }, [])
  return { data: result.data, error: result.error, loading: Boolean(url) && result.key !== key, reload, version: result.version, setData }
}
