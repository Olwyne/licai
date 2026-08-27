import type { Account, Member, Bank } from "@/db/schema"

export type EnrichedAccount = Omit<Account, "ownerIds"> & {
  ownerIds: string[]
  ownerNames: string[]
}

export type { Member, Bank }
