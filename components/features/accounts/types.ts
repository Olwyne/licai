import type { Account, Member, Bank } from "@/db/schema"

export type EnrichedAccount = Omit<Account, "ownerIds"> & {
  ownerIds: string[]
  ownerNames: string[]
  balanceBaseCents: number // solde converti dans la devise de référence du foyer
}

export type { Member, Bank }
