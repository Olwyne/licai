"use client"
import { useState } from "react"
import { HouseholdCard } from "./HouseholdCard"
import { AccountGroups } from "./AccountGroups"
import { MemberModal } from "./MemberModal"
import { AccountModal } from "./AccountModal"
import type { EnrichedAccount, Member, Bank } from "./types"

interface Props {
  household: { name: string; householdId: string }
  members: Member[]
  banks: Bank[]
  accounts: EnrichedAccount[]
}

export function AccountsClient({ household, members, banks, accounts }: Props) {
  const [memberList, setMemberList] = useState<Member[]>(members)
  const [accountList, setAccountList] = useState<EnrichedAccount[]>(accounts)
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)

  function handleMemberSaved(member: Member) {
    setMemberList((prev) => [member, ...prev])
    setShowMemberModal(false)
  }

  function handleAccountSaved(account: EnrichedAccount) {
    setAccountList((prev) => [account, ...prev])
    setShowAccountModal(false)
  }

  const uniqueBankIds = new Set(accountList.map((a) => a.bankId).filter(Boolean))

  return (
    <>
      <div className="page-comptes">
        <HouseholdCard
          householdName={household.name}
          members={memberList}
          accounts={accountList}
          banksCount={uniqueBankIds.size}
          onAddMember={() => setShowMemberModal(true)}
        />
        <AccountGroups
          members={memberList}
          banks={banks}
          accounts={accountList}
          ownerFilter={ownerFilter}
          onOwnerFilter={setOwnerFilter}
          onAddAccount={() => setShowAccountModal(true)}
        />
      </div>

      {showMemberModal && (
        <MemberModal
          onClose={() => setShowMemberModal(false)}
          onSaved={handleMemberSaved}
        />
      )}

      {showAccountModal && (
        <AccountModal
          members={memberList}
          banks={banks}
          onClose={() => setShowAccountModal(false)}
          onSaved={handleAccountSaved}
        />
      )}
    </>
  )
}
