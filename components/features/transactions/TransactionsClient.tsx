"use client"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents, maskAmount } from "@/lib/money"
import { FilterPanel, DEFAULT_FILTERS } from "./FilterPanel"
import { TransactionList } from "./TransactionList"
import { BulkBar } from "./BulkBar"
import { TransactionModal } from "./TransactionModal"
import { CsvImportWizard } from "./CsvImportWizard"
import type { Filters } from "./FilterPanel"
import type { Transaction, Account, Member, Category, Bank, Goal, Project } from "@/db/schema"

interface Props {
  initialTransactions: Transaction[]
  accounts: Account[]
  members: Member[]
  categories: Category[]
  banks: Bank[]
  goals: Goal[]
  projects: Project[]
}

const NOW = new Date()
const CUR_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`
const LAST_MONTH_DATE = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1)
const LAST_MONTH = `${LAST_MONTH_DATE.getFullYear()}-${String(LAST_MONTH_DATE.getMonth() + 1).padStart(2, "0")}`
const THREE_MONTHS_AGO_DATE = new Date(NOW.getFullYear(), NOW.getMonth() - 2, 1)
const THREE_MONTHS_AGO = `${THREE_MONTHS_AGO_DATE.getFullYear()}-${String(THREE_MONTHS_AGO_DATE.getMonth() + 1).padStart(2, "0")}-01`
const CUR_YEAR = String(NOW.getFullYear())

const TODAY = NOW.toISOString().slice(0, 10)
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 29 * 86400000).toISOString().slice(0, 10)
const isIncome = (t: Transaction) => t.kind !== "transfer" && t.amountCents > 0
const isExpense = (t: Transaction) => t.kind !== "transfer" && t.amountCents < 0
const num = (v: string): number | null => { const n = parseFloat(v.replace(/\s/g, "").replace(",", ".")); return isNaN(n) ? null : n }

function applyFilters(txs: Transaction[], f: Filters): Transaction[] {
  const min = num(f.min), max = num(f.max)
  const out = txs.filter((tx) => {
    if (f.q && !tx.name.toLowerCase().includes(f.q.toLowerCase())) return false
    if (f.accountId && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false
    if (f.memberId && tx.memberId !== f.memberId) return false
    if (f.cat === "income" && !isIncome(tx)) return false
    if (f.cat !== "all" && f.cat !== "income" && tx.categoryId !== f.cat) return false
    if (f.type === "income" && !isIncome(tx)) return false
    if (f.type === "expense" && !isExpense(tx)) return false
    if (f.shared === "yes" && !tx.isCommon) return false
    if (f.shared === "no" && tx.isCommon) return false
    const abs = Math.abs(tx.amountCents) / 100
    if (min !== null && abs < min) return false
    if (max !== null && abs > max) return false
    switch (f.period) {
      case "current": if (!tx.date.startsWith(CUR_MONTH)) return false; break
      case "last": if (!tx.date.startsWith(LAST_MONTH)) return false; break
      case "30": if (tx.date < THIRTY_DAYS_AGO || tx.date > TODAY) return false; break
      case "3months": if (tx.date < THREE_MONTHS_AGO) return false; break
      case "year": if (!tx.date.startsWith(CUR_YEAR)) return false; break
    }
    return true
  })
  const by: Record<Filters["sort"], (a: Transaction, b: Transaction) => number> = {
    date: (a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime(),
    "date-asc": (a, b) => a.date.localeCompare(b.date),
    amount: (a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents),
    "amount-asc": (a, b) => Math.abs(a.amountCents) - Math.abs(b.amountCents),
  }
  return out.sort(by[f.sort])
}

export function TransactionsClient({
  initialTransactions,
  accounts,
  members,
  categories,
  banks,
  goals,
  projects,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const PAGE_SIZE = 50

  const [txList, setTxList] = useState<Transaction[]>(initialTransactions)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  useEffect(() => { if (new URLSearchParams(window.location.search).get("import") === "1") setShowImportModal(true) }, [])
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [page, setPage] = useState(0)

  const filteredTx = useMemo(() => applyFilters(txList, filters), [txList, filters])
  const totalPages = Math.max(1, Math.ceil(filteredTx.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pagedTx = useMemo(
    () => filteredTx.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filteredTx, safePage, PAGE_SIZE]
  )

  // Reset to page 0 on filter change
  useEffect(() => { setPage(0) }, [filters])

  const expenseCents = useMemo(
    () => filteredTx.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amountCents, 0),
    [filteredTx]
  )

  // ── Selection handlers ──

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  const allPageSelected = pagedTx.length > 0 && pagedTx.every((t) => selected.has(t.id))
  const somePageSelected = pagedTx.some((t) => selected.has(t.id))

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        pagedTx.forEach((t) => next.delete(t.id))
      } else {
        pagedTx.forEach((t) => next.add(t.id))
      }
      return next
    })
  }

  // ── Mutation handlers ──

  function handleSaved(tx: Transaction) {
    setTxList((prev) => {
      const idx = prev.findIndex((t) => t.id === tx.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = tx
        return next
      }
      return [tx, ...prev]
    })
    setShowAddModal(false)
    setEditingTx(null)
  }

  function handleDeleted(id: string) {
    setTxList((prev) => prev.filter((t) => t.id !== id))
    setEditingTx(null)
  }

  function handleBulkPatch(ids: string[], patch: Partial<Transaction>) {
    setTxList((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)))
    clearSelection()
  }

  function handleBulkDelete(ids: string[]) {
    setTxList((prev) => prev.filter((t) => !ids.includes(t.id)))
    clearSelection()
  }

  function handleImported(newTxs: Transaction[]) {
    setTxList((prev) => [...newTxs, ...prev])
    setShowImportModal(false)
  }

  const n = filteredTx.length

  return (
    <div className="page-transactions">
      <div className="tx-page-header">
        <h1>Transactions</h1>
        <div className="tx-page-actions">
          <Button variant="ghost" size="sm" onClick={() => setShowImportModal(true)}>
            Importer CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            + Ajouter une transaction
          </Button>
        </div>
      </div>

      <FilterPanel
        filters={filters}
        accounts={accounts}
        categories={categories}
        members={members}
        count={filteredTx.length}
        total={txList.length}
        onChange={setFilters}
      />

      <div className="tx-count-bar">
        {n} opération{n > 1 ? "s" : ""}
        {" · "}
        <span className={isPrivate ? "private" : ""}>
          {isPrivate ? maskAmount("") : formatCents(Math.abs(expenseCents))}
        </span>
        {" de dépenses"}
        {totalPages > 1 && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <i className="ti ti-chevron-left" />
            </button>
            <span style={{ fontSize: 12, color: "var(--fg-secondary)" }}>
              {safePage + 1} / {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage === totalPages - 1}
            >
              <i className="ti ti-chevron-right" />
            </button>
          </span>
        )}
      </div>

      <BulkBar
        selected={selected}
        txList={txList}
        categories={categories}
        members={members}
        onBulkPatch={handleBulkPatch}
        onBulkDelete={handleBulkDelete}
        onClearSelection={clearSelection}
      />

      <TransactionList
        transactions={pagedTx}
        accounts={accounts}
        categories={categories}
        selected={selected}
        onToggleSelect={toggleSelect}
        allPageSelected={allPageSelected}
        somePageSelected={somePageSelected}
        onSelectAll={toggleSelectAll}
        onEdit={(tx) => setEditingTx(tx)}
      />



      {(showAddModal || editingTx !== null) && (
        <TransactionModal
          editingTx={editingTx}
          accounts={accounts}
          categories={categories}
          goals={goals}
          projects={projects}
          members={members}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={() => { setShowAddModal(false); setEditingTx(null) }}
        />
      )}

      {showImportModal && (
        <CsvImportWizard
          accounts={accounts}
          banks={banks}
          categories={categories}
          txList={txList}
          members={members}
          onImported={handleImported}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
