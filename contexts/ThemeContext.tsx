"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react"

type Theme = "dark" | "light"
interface ThemeCtx { theme: Theme; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} })

const KEY = "licai-theme"
const EVENT = "licai-theme-changed"
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb); window.addEventListener(EVENT, cb)
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb) }
}
const read = (): Theme => { try { return localStorage.getItem(KEY) === "light" ? "light" : "dark" } catch { return "dark" } }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // sombre au rendu serveur et à l'hydratation, puis préférence enregistrée (un script en tête de page l'applique avant le premier rendu)
  const theme = useSyncExternalStore(subscribe, read, (): Theme => "dark")
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme) }, [theme]) // synchronisation avec le DOM
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, read() === "dark" ? "light" : "dark") } catch { /* stockage indisponible */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
