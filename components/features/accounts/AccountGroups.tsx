"use client"
import { fmtCurrency, getBaseCurrency } from "@/lib/finance/fx"
import { formatCents } from "@/lib/money"
import { usePrivacy } from "@/contexts/PrivacyContext"
import Link from "next/link"
import { Chip } from "@/components/ui/Chip"
import type { EnrichedAccount, Member, Bank } from "./types"

const TYPE_LABELS: Record<string, string> = {
  checking: "Courant",
  savings: "Épargne",
  investment: "Investissement",
  other: "Autre",
}

function isChildOnlyAccount(account: EnrichedAccount, members: Member[]): boolean {
  if (account.ownerIds.length === 0) return false
  return account.ownerIds.every((id) => members.find((m) => m.id === id)?.isChild === true)
}

interface Props {
  members: Member[]
  banks: Bank[]
  accounts: EnrichedAccount[]
  ownerFilter: string
  onOwnerFilter: (f: string) => void
  txCounts?: Record<string, number>
  onEditAccount?: (account: EnrichedAccount) => void
  childViewId?: string | null
}

export function AccountGroups({
  members,
  banks,
  accounts,
  ownerFilter,
  onOwnerFilter,
  txCounts = {},
  onEditAccount,
  childViewId,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const visibleAccounts = childViewId
    ? accounts.filter((a) => a.ownerIds.includes(childViewId))
    : accounts

  const filtered =
    ownerFilter === "all"
      ? visibleAccounts
      : ownerFilter === "shared"
      ? visibleAccounts.filter((a) => a.ownerIds.length > 1)
      : visibleAccounts.filter((a) => a.ownerIds.includes(ownerFilter))

  const bankMap = new Map(banks.map((b) => [b.id, b]))

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
      {!childViewId && (
        <div className="accounts-toolbar">
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
          <Link className="btn btn-primary" href="/transactions?import=1"><i className="ti ti-file-import" /> Importer un CSV</Link>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty-state">Aucun compte pour ce filtre</div>
      )}

      {groupOrder.map((bankId) => {
        const bankAccounts = groupMap.get(bankId) ?? []
        const bank = bankId ? bankMap.get(bankId) : undefined
        const bankName = bank?.name ?? "Sans banque"
        const bankColor = bank?.colorHex ?? "#888888"
        const bankSum = bankAccounts.reduce((sum, a) => sum + a.balanceBaseCents, 0)

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
                const childOnly = isChildOnlyAccount(account, members)
                return (
                  <div
                    key={account.id}
                    className={`acct-card${onEditAccount ? " acct-card--clickable" : ""}`}
                    onClick={() => onEditAccount?.(account)}
                    role={onEditAccount ? "button" : undefined}
                    tabIndex={onEditAccount ? 0 : undefined}
                    onKeyDown={(e) => e.key === "Enter" && onEditAccount?.(account)}
                  >
                    <div className="acct-top">
                      <div>
                        <div className="acct-name">{account.name}</div>
                        <div className="acct-meta">
                          {typeLabel}{account.last4 ? ` · •••• ${account.last4}` : ""}
                          {isShared && <> · <span className="acct-shared">Partagé</span></>}
                        </div>
                        {account.purpose && <div className="acct-purpose"><i className="ti ti-target-arrow" /> {account.purpose}</div>}
                      </div>
                      {account.ownerIds.length > 0 && (
                        <div className="acct-owners">
                          {account.ownerIds.map((ownerId) => {
                            const m = members.find((mm) => mm.id === ownerId)
                            return (
                              <span
                                key={ownerId}
                                className="mini-av"
                                style={m ? { background: `${m.colorHex}22`, color: m.colorHex, borderColor: `${m.colorHex}55`, width: 26, height: 26 } : { width: 26, height: 26 }}
                                title={m?.name}
                              >
                                {(m?.short ?? ownerId)[0]}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className={`acct-balance num${isPrivate ? " private" : ""}`}>
                      {account.currency !== getBaseCurrency() ? fmtCurrency(account.balanceCents / 100, account.currency) : formatCents(account.balanceCents)}
                    </div>
                    {account.currency !== getBaseCurrency() && (
                      <div className={`acct-cur num${isPrivate ? " private" : ""}`}>≈ {formatCents(account.balanceBaseCents)}</div>
                    )}
                    <div className="acct-foot">
                      <span className="acct-sync">
                        <i className="ti ti-refresh" /> {(txCounts[account.id] ?? 0) === 0 ? "Aucune opération" : `${txCounts[account.id]} opération${txCounts[account.id] > 1 ? "s" : ""}`}
                      </span>
                      {!childOnly && (
                        <Link className="acct-import" href="/transactions?import=1" onClick={(e) => e.stopPropagation()}>
                          <i className="ti ti-file-import" /> Importer
                        </Link>
                      )}
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
