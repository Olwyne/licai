"use client"
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

interface NavCtx { open: boolean; toggle: () => void; close: () => void }
const Ctx = createContext<NavCtx>({ open: false, toggle: () => {}, close: () => {} })

// Tiroir de navigation (mobile) : fermé à chaque changement de page.
export function NavProvider({ children }: { children: React.ReactNode }) {
  // le tiroir est « ouvert pour » une page : changer de page le referme sans effet ni état à resynchroniser
  const [openFor, setOpenFor] = useState<string | null>(null)
  const path = usePathname()
  const open = openFor === path
  const toggle = useCallback(() => setOpenFor((o) => (o === path ? null : path)), [path])
  const close = useCallback(() => setOpenFor(null), [])
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useNav = () => useContext(Ctx)
