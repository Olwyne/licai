"use client"
import { useCallback, useMemo, useState, useSyncExternalStore } from "react"

const EVENT = "licai-local-storage"

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb); window.addEventListener(EVENT, cb)
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb) }
}
const readRaw = (key: string): string | null => { try { return localStorage.getItem(key) } catch { return null } }

/**
 * Valeur JSON conservée dans le navigateur. Au rendu serveur et à l'hydratation : `initial` ; ensuite la valeur enregistrée
 * (useSyncExternalStore : pas de setState dans un effet). Mise à jour entre onglets et composants incluse.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [initialValue] = useState(initial) // valeur par défaut figée au premier rendu
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null)
  const value = useMemo(() => {
    if (raw === null) return initialValue
    try { return JSON.parse(raw) as T } catch { return initialValue }
  }, [raw, initialValue])
  const set = useCallback((v: T | ((prev: T) => T)) => {
    let prev = initialValue
    try { const r = readRaw(key); if (r !== null) prev = JSON.parse(r) as T } catch { /* valeur par défaut */ }
    const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* stockage indisponible */ }
    window.dispatchEvent(new Event(EVENT))
  }, [key, initialValue])
  return [value, set]
}
