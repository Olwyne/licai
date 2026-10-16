"use client"
import { useCallback, useEffect, useState } from "react"
import type { FinanceContext } from "@/lib/finance/types"

export function useFinanceContext() {
  const [ctx, setCtx] = useState<FinanceContext | null>(null)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/context")
      if (!res.ok) { setError("Impossible de charger les données."); return }
      const json = (await res.json()) as { data: FinanceContext }
      setCtx(json.data)
      setError("")
    } catch {
      setError("Erreur réseau.")
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { ctx, error, reload }
}
