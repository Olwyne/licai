"use client"
import { fmtCurrency } from "@/lib/finance/fx"
import { useRef, useEffect } from "react"
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
  allPageSelected?: boolean
  somePageSelected?: boolean
  onSelectAll?: () => void
}

function dayLabel(date: string): string {
  const d = new Date(date + "T12:00:00")
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (date === today) return "Aujourd'hui"
  if (date === yesterday) return "Hier"
  const raw = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  selected,
  onToggleSelect,
  onEdit,
  allPageSelected = false,
  somePageSelected = false,
  onSelectAll,
}: Props) {
  const { private: isPrivate } = usePrivacy()
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected
    }
  }, [somePageSelected, allPageSelected])

  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Group by day (YYYY-MM-DD), sorted descending
  const months = [...new Set(transactions.map((tx) => tx.date))].sort().reverse()

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <span>Aucune opération</span>
      </div>
    )
  }

  return (
    <div className="tx-list">
      {onSelectAll && (
        <div className="tx-select-all-row">
          <input
            ref={selectAllRef}
            type="checkbox"
            className="tx-check"
            checked={allPageSelected}
            onChange={onSelectAll}
            title="Tout sélectionner"
          />
          <span style={{ fontSize: 12.5, color: "var(--fg-muted)", userSelect: "none", cursor: "pointer" }} onClick={onSelectAll}>
            {allPageSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </span>
        </div>
      )}
      {months.map((day) => {
        const txs = transactions.filter((tx) => tx.date === day)
        return (
          <div key={day} className="tx-month-group">
            <div className="tx-month-head">{dayLabel(day)}</div>
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
                  {tx.kind === "transfer" ? (
                    <span className="tx-icon tx-icon-transfer">
                      <i className="ti ti-arrows-exchange" />
                    </span>
                  ) : cat ? (
                    <span className="tx-icon" style={{ background: `${cat.colorHex}22`, color: cat.colorHex }}>
                      <i className={`ti ${cat.icon}`} />
                    </span>
                  ) : (
                    <span className="tx-icon tx-icon-empty">
                      <i className="ti ti-receipt" />
                    </span>
                  )}
                  <div className="tx-info">
                    <div className="tx-name">{tx.name}</div>
                    <div className="tx-meta">
                      {tx.kind === "transfer"
                        ? `${acc ? acc.name : "—"} → ${tx.toAccountId ? (accountMap.get(tx.toAccountId)?.name ?? "—") : "—"}`
                        : acc ? acc.name : ""}
                      {cat ? ` · ${cat.label}` : ""}
                    </div>
                  </div>
                  <span className={`tx-amt${tx.kind === "transfer" ? " transfer" : tx.amountCents >= 0 ? " pos" : " neg"}${isPrivate ? " private" : ""}`}>
                    {isPrivate ? maskAmount("") : (tx.kind === "transfer" ? `⇄ ${formatCents(tx.amountCents)}` : formatCents(tx.amountCents))}
                    {!isPrivate && tx.originalCurrency && tx.originalCents != null && (
                      <small style={{ display: "block", fontSize: 11, color: "var(--fg-muted)", fontWeight: 400 }}>{fmtCurrency(tx.originalCents / 100, tx.originalCurrency)}</small>
                    )}
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
