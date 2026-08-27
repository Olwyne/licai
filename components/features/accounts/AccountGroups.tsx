"use client"
import { formatCents } from "@/lib/money"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { Chip } from "@/components/ui/Chip"
import type { EnrichedAccount, Member, Bank } from "./types"

const TYPE_LABELS: Record<string, string> = {
  checking: "Courant",
  savings: "Épargne",
  investment: "Investissement",
  other: "Autre",
}

interface Props {
  members: Member[]
  banks: Bank[]
  accounts: EnrichedAccount[]
  ownerFilter: string
  onOwnerFilter: (f: string) => void
  onAddAccount: () => void
}

export function AccountGroups({
  members,
  banks,
  accounts,
  ownerFilter,
  onOwnerFilter,
  onAddAccount,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const filtered =
    ownerFilter === "all"
      ? accounts
      : ownerFilter === "shared"
      ? accounts.filter((a) => a.ownerIds.length > 1)
      : accounts.filter((a) => a.ownerIds.includes(ownerFilter))

  const bankMap = new Map(banks.map((b) => [b.id, b]))

  // Group by bankId preserving insertion order
  const groupOrder: (string | null)[] = []
  const groupMap = new Map<string | null, EnrichedAccount[]>()
  for (const account of filtered) {
    const key = account.bankId ?? null
    if (!groupMap.has(key)) {
      groupOrder.push(key)
      groupMap.set(key, [])
    }
    groupMap.get(key)!.push(account)
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div className="owner-chips">
          <Chip active={ownerFilter === "all"} onClick={() => onOwnerFilter("all")}>
            Tout le foyer
          </Chip>
          {members.map((m) => (
            <Chip
              key={m.id}
              active={ownerFilter === m.id}
              onClick={() => onOwnerFilter(m.id)}
            >
              {m.short}
            </Chip>
          ))}
          <Chip
            active={ownerFilter === "shared"}
            onClick={() => onOwnerFilter("shared")}
          >
            Comptes partagés
          </Chip>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAddAccount} type="button">
          + Nouveau compte
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">Aucun compte pour ce filtre</div>
      )}

      {groupOrder.map((bankId) => {
        const bankAccounts = groupMap.get(bankId) ?? []
        const bank = bankId ? bankMap.get(bankId) : undefined
        const bankName = bank?.name ?? "Sans banque"
        const bankColor = bank?.colorHex ?? "#888888"
        const bankSum = bankAccounts.reduce((sum, a) => sum + a.balanceCents, 0)

        return (
          <div key={bankId ?? "__none"} className="bank-group">
            <div className="bank-head">
              <span
                className="bank-logo"
                style={{ background: `${bankColor}1f`, color: bankColor }}
              >
                {bankName[0]}
              </span>
              <span className="bank-name">{bankName}</span>
              <span className="bank-count">
                {bankAccounts.length} compte{bankAccounts.length > 1 ? "s" : ""}
              </span>
              <span className={`bank-sum${isPrivate ? " private" : ""}`}>
                {formatCents(bankSum)}
              </span>
            </div>
            <div className="acct-grid">
              {bankAccounts.map((account) => {
                const isShared = account.ownerIds.length > 1
                const typeLabel = TYPE_LABELS[account.type] ?? account.type
                return (
                  <div key={account.id} className="acct-card">
                    <div className="acct-top">
                      <div>
                        <div className="acct-name">{account.name}</div>
                        <div className="acct-meta">
                          {typeLabel}
                          {isShared && (
                            <span className="acct-shared"> · Partagé</span>
                          )}
                        </div>
                        {account.ownerIds.length > 0 && (
                          <div className="acct-owners">
                            {account.ownerIds.map((ownerId) => {
                              const m = members.find((mm) => mm.id === ownerId)
                              if (m) {
                                return (
                                  <span
                                    key={ownerId}
                                    className="mini-av"
                                    style={{
                                      background: `${m.colorHex}22`,
                                      color: m.colorHex,
                                      borderColor: `${m.colorHex}55`,
                                    }}
                                    title={m.name}
                                  >
                                    {m.short[0]}
                                  </span>
                                )
                              }
                              return (
                                <span key={ownerId} className="mini-av">
                                  {ownerId[0]}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`acct-balance${isPrivate ? " private" : ""}`}>
                      {formatCents(account.balanceCents)}
                    </div>
                    <div className="acct-foot">
                      <span className="acct-sync">
                        ↻{" "}
                        {account.ownerNames.length > 0
                          ? account.ownerNames.join(", ")
                          : "—"}
                      </span>
                      <button className="acct-import" disabled type="button">
                        ⬆ Importer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
