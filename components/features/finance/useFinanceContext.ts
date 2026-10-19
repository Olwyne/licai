"use client"
import { useFetch } from "@/lib/use-fetch"
import type { FinanceContext } from "@/lib/finance/types"

/** Contexte financier du foyer (comptes, crédits, biens, placements…) chargé depuis l'API. */
export function useFinanceContext() {
  const { data, error, reload } = useFetch<FinanceContext>("/api/finance/context")
  return { ctx: data, error, reload }
}
