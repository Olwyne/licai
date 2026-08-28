"use client"
import { useState, useEffect } from "react"
import { SearchContext } from "@/contexts/SearchContext"
import { CommandPalette } from "./CommandPalette"

export function CmdPaletteWrapper({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <SearchContext.Provider value={{ openSearch: () => setOpen(true) }}>
      {children}
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </SearchContext.Provider>
  )
}
