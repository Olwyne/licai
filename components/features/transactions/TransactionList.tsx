"use client"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents, maskAmount } from "@/lib/money"
import type { Transaction, Account, Category } from "@/db/schema"

interface Props {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onEdit: (tx: Transaction) => void
}

function monthLabel(month: string): string {
  const d = new Date(month + "-02") // day 2 avoids UTC offset issues
  const raw = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function shortDate(date: string): string {
  // date is YYYY-MM-DD → DD/MM
  const parts = date.split("-")
  return `${parts[2]}/${parts[1]}`
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  selected,
  onToggleSelect,
  onEdit,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Group by month (YYYY-MM), sorted descending
  const months = [...new Set(transactions.map((tx) => tx.date.slice(0, 7)))].sort().reverse()

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <span>Aucune opération</span>
      </div>
    )
  }

  return (
    <div className="tx-list">
      {months.map((month) => {
        const txs = transactions.filter((tx) => tx.date.startsWith(month))
        return (
          <div key={month} className="tx-month-group">
            <div className="tx-month-head">{monthLabel(month)}</div>
            {txs.map((tx) => {
              const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
              const acc = tx.accountId ? accountMap.get(tx.accountId) : undefined
              const isSel = selected.has(tx.id)
              return (
                <div
                  key={tx.id}
                  className={`tx-item${isSel ? " sel" : ""}`}
                  onClick={() => onEdit(tx)}
                >
                  <input
                    type="checkbox"
                    className="tx-check"
                    checked={isSel}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleSelect(tx.id)}
                  />
                  {cat ? (
                    <span
                      className="tx-icon"
                      style={{
                        background: `${cat.colorHex}22`,
                        color: cat.colorHex,
                      }}
                    >
                      <i className={`ti ${cat.icon}`} />
                    </span>
                  ) : (
                    <span className="tx-icon" style={{ background: "var(--border)" }}>
                      <i className="ti ti-receipt" />
                    </span>
                  )}
                  <div className="tx-info">
                    <div className="tx-name">{tx.name}</div>
                    <div className="tx-meta">
                      {shortDate(tx.date)}
                      {acc ? ` · ${acc.name}` : ""}
                      {cat ? ` · ${cat.label}` : ""}
                    </div>
                  </div>
                  <span
                    className={`tx-amt${tx.amountCents >= 0 ? " pos" : " neg"}${isPrivate ? " private" : ""}`}
                  >
                    {isPrivate ? maskAmount("") : formatCents(tx.amountCents)}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
