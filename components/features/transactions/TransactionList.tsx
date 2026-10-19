"use client"
import { fmtCurrency } from "@/lib/finance/fx"
import { useRef, useEffect } from "react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents, maskAmount } from "@/lib/money"
import type { Transaction, Account, Category, Bank, Member } from "@/db/schema"

interface Props {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  banks?: Bank[]
  members?: Member[]
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
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  banks = [],
  members = [],
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
  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const memberMap = new Map(members.map((m) => [m.id, m]))

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
    <div className="card tx-list">
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
          <div key={day}>
            <div className="tx-day-label">{dayLabel(day)}</div>
            {txs.map((tx) => {
              const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
              const acc = tx.accountId ? accountMap.get(tx.accountId) : undefined
              const bank = acc?.bankId ? bankMap.get(acc.bankId) : undefined
              const payer = tx.memberId ? memberMap.get(tx.memberId) : undefined
              const isSel = selected.has(tx.id)
              const transfer = tx.kind === "transfer"
              const pos = tx.amountCents >= 0
              return (
                <div key={tx.id} className={`tx-item selectable${isSel ? " sel" : ""}`} onClick={() => onEdit(tx)}>
                  <label className="tx-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => onToggleSelect(tx.id)} />
                  </label>
                  {transfer ? (
                    <span className="tx-icon tx-icon-transfer"><i className="ti ti-arrows-exchange" /></span>
                  ) : cat ? (
                    <span className="tx-icon" style={{ background: `${cat.colorHex}22`, color: cat.colorHex }}><i className={`ti ${cat.icon}`} /></span>
                  ) : (
                    <span className="tx-icon tx-icon-empty"><i className="ti ti-receipt" /></span>
                  )}
                  <div className="tx-info">
                    <div className="tx-name">{tx.name}</div>
                    <div className="tx-meta">
                      <span className="tx-cat-tag">{transfer ? "Virement" : cat?.label ?? "Sans catégorie"}</span>
                      {acc && (
                        <span className="tx-acct">
                          <span className="tx-acct-dot" style={{ background: bank?.colorHex ?? "var(--fg-muted)" }} />
                          {bank ? `${bank.name} · ` : ""}{acc.name}
                          {transfer && tx.toAccountId ? ` → ${accountMap.get(tx.toAccountId)?.name ?? "—"}` : ""}
                        </span>
                      )}
                      {payer && <span className="tx-payer" style={{ borderColor: `${payer.colorHex}55`, color: payer.colorHex }}>{payer.short || payer.name}</span>}
                      {!transfer && tx.isCommon && <span className="tx-payer shared">Commune</span>}
                    </div>
                    {tx.note && <div className="tx-row-note">{tx.note}</div>}
                  </div>
                  <div className="tx-row-amount">
                    <div className={`tx-amount num${transfer ? "" : pos ? " pos" : " neg"}${isPrivate ? " private" : ""}`}>
                      {isPrivate ? maskAmount("") : transfer ? `⇄ ${formatCents(tx.amountCents)}` : `${pos ? "+" : "−"}${formatCents(Math.abs(tx.amountCents))}`}
                    </div>
                    {!isPrivate && tx.originalCurrency && tx.originalCents != null && (
                      <div className="tx-row-note">{fmtCurrency(tx.originalCents / 100, tx.originalCurrency)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
