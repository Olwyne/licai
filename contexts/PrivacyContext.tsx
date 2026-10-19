"use client"
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"

interface PrivacyCtx { private: boolean; toggle: () => void }
const Ctx = createContext<PrivacyCtx>({ private: false, toggle: () => {} })

const KEY = "licai-privacy"
const EVENT = "licai-privacy-changed"
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb); window.addEventListener(EVENT, cb)
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb) }
}
const read = (): boolean => { try { return localStorage.getItem(KEY) === "1" } catch { return false } }

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // faux au rendu serveur et à l'hydratation, puis valeur enregistrée dans le navigateur
  const priv = useSyncExternalStore(subscribe, read, () => false)
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, read() ? "0" : "1") } catch { /* stockage indisponible */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])
  const value = useMemo(() => ({ private: priv, toggle }), [priv, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePrivacy = () => useContext(Ctx)
