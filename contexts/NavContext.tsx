"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

interface NavCtx { open: boolean; toggle: () => void; close: () => void }
const Ctx = createContext<NavCtx>({ open: false, toggle: () => {}, close: () => {} })

// Tiroir de navigation (mobile) : fermé à chaque changement de page.
export function NavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const path = usePathname()
  useEffect(() => { setOpen(false) }, [path])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const close = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useNav = () => useContext(Ctx)
