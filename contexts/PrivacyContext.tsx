"use client"
import { createContext, useContext, useState, useEffect } from "react"

interface PrivacyCtx { private: boolean; toggle: () => void }
const Ctx = createContext<PrivacyCtx>({ private: false, toggle: () => {} })

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [priv, setPriv] = useState(false)
  useEffect(() => {
    try { setPriv(localStorage.getItem("licai-privacy") === "1") } catch {}
  }, [])
  function toggle() {
    setPriv(p => {
      try { localStorage.setItem("licai-privacy", p ? "0" : "1") } catch {}
      return !p
    })
  }
  return <Ctx.Provider value={{ private: priv, toggle }}>{children}</Ctx.Provider>
}

export const usePrivacy = () => useContext(Ctx)
