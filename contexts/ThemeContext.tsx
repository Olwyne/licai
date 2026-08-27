"use client"
import { createContext, useContext, useState, useEffect } from "react"

interface ThemeCtx { theme: "dark" | "light"; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  useEffect(() => {
    const saved = (localStorage.getItem("licai-theme") ?? "dark") as "dark" | "light"
    setTheme(saved)
    document.documentElement.setAttribute("data-theme", saved)
  }, [])
  function toggle() {
    setTheme(t => {
      const next = t === "dark" ? "light" : "dark"
      localStorage.setItem("licai-theme", next)
      document.documentElement.setAttribute("data-theme", next)
      return next
    })
  }
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
