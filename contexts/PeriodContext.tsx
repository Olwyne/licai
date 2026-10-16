"use client"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

const currentMonth = () => new Date().toISOString().slice(0, 7)
export const shiftMonth = (ym: string, delta: number): string => {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface PeriodCtx {
  month: string // YYYY-MM
  touched: boolean // le mois a été choisi par l'utilisateur (sinon les écrans gardent leur vue par défaut)
  setMonth: (m: string) => void
  reset: () => void
}

const Ctx = createContext<PeriodCtx>({ month: currentMonth(), touched: false, setMonth: () => {}, reset: () => {} })

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [month, setM] = useState(currentMonth)
  const [touched, setTouched] = useState(false)
  const setMonth = useCallback((m: string) => { setM(m); setTouched(true) }, [])
  const reset = useCallback(() => { setM(currentMonth()); setTouched(false) }, [])
  const value = useMemo(() => ({ month, touched, setMonth, reset }), [month, touched, setMonth, reset])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePeriod = () => useContext(Ctx)
