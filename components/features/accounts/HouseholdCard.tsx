"use client"
import { formatCents } from "@/lib/money"
import { usePrivacy } from "@/contexts/PrivacyContext"
import type { EnrichedAccount, Member } from "./types"

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

interface Props {
  householdName: string
  members: Member[]
  accounts: EnrichedAccount[]
  banksCount: number
  onAddMember: () => void
}

export function HouseholdCard({
  householdName,
  members,
  accounts,
  banksCount,
  onAddMember,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const totalBalance = accounts.reduce((sum, a) => sum + a.balanceCents, 0)

  const memberStats = members.map((m) => {
    const memberAccounts = accounts.filter((a) => a.ownerIds.includes(m.id))
    const memberBalance = memberAccounts.reduce((sum, a) => sum + a.balanceCents, 0)
    return { ...m, accountCount: memberAccounts.length, balance: memberBalance }
  })

  return (
    <div className="card">
      <div className="hh-head">
        <div className="hh-mark">🏠</div>
        <div>
          <div className="hh-name">{householdName}</div>
          <div className="hh-sub">
            {members.length} personne{members.length > 1 ? "s" : ""} ·{" "}
            {accounts.length} compte{accounts.length > 1 ? "s" : ""} ·{" "}
            {banksCount} banque{banksCount > 1 ? "s" : ""}
          </div>
        </div>
        <div className="hh-total">
          <div className="hh-total-lbl">Patrimoine total</div>
          <div className={`hh-total-val${isPrivate ? " private" : ""}`}>
            {formatCents(totalBalance)}
          </div>
        </div>
      </div>
      <div className="member-grid">
        {memberStats.map((m) => (
          <div key={m.id} className="member-card">
            <span
              className="mini-av"
              style={{
                background: `${m.colorHex}22`,
                color: m.colorHex,
                borderColor: `${m.colorHex}55`,
              }}
            >
              {initials(m.name)}
            </span>
            <div className="member-info">
              <div className="member-name">{m.name}</div>
              <div className="member-role">{m.role}</div>
            </div>
            <div className="member-nums">
              <div className={`member-sum${isPrivate ? " private" : ""}`}>
                {formatCents(m.balance)}
              </div>
              <div className="member-accs">
                {m.accountCount} compte{m.accountCount > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        ))}
        <div
          className="member-card add"
          onClick={onAddMember}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onAddMember()}
        >
          <span>+</span>
          <span>Ajouter une personne</span>
        </div>
      </div>
    </div>
  )
}
