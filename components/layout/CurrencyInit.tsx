"use client"
import { setBaseCurrency } from "@/lib/finance/fx"

// Renseigne la devise de référence du foyer avant le rendu des montants (rendu synchrone, avant les enfants).
export function CurrencyInit({ currency }: { currency: string }) {
  setBaseCurrency(currency)
  return null
}
