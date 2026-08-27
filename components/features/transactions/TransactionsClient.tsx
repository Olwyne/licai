"use client"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/Button"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents, maskAmount } from "@/lib/money"
import { FilterPanel, DEFAULT_FILTERS } from "./FilterPanel"
import { TransactionList } from "./TransactionList"
import { BulkBar } from "./BulkBar"
import { TransactionModal } from "./TransactionModal"
import { CsvImportWizard } from "./CsvImportWizard"
import type { Filters } from "./FilterPanel"
import type { Transaction, Account, Member, Category, Bank } from "@/db/schema"

interface Props {
  initialTransactions: Transaction[]
  accounts: Account[]
  members: Member[]
  categories: Category[]
  banks: Bank[]
}

const NOW = new Date()
const CUR_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`
const LAST_MONTH_DATE = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1)
const LAST_MONTH = `${LAST_MONTH_DATE.getFullYear()}-${String(LAST_MONTH_DATE.getMonth() + 1).padStart(2, "0")}`
const THREE_MONTHS_AGO_DATE = new Date(NOW.getFullYear(), NOW.getMonth() - 2, 1)
const THREE_MONTHS_AGO = `${THREE_MONTHS_AGO_DATE.getFullYear()}-${String(THREE_MONTHS_AGO_DATE.getMonth() + 1).padStart(2, "0")}-01`
const CUR_YEAR = String(NOW.getFullYear())

function applyFilters(txs: Transaction[], f: Filters): Transaction[] {
  return txs.filter((tx) => {
    if (f.q && !tx.name.toLowerCase().includes(f.q.toLowerCase())) return false
    if (f.accountId && tx.accountId !== f.accountId) return false
    if (f.categoryId && tx.categoryId !== f.categoryId) return false
    if (f.type === "income" && tx.amountCents < 0) return false
    if (f.type === "expense" && tx.amountCents >= 0) return false

    switch (f.period) {
      case "current":
        if (!tx.date.startsWith(CUR_MONTH)) return false
        break
      case "last":
        if (!tx.date.startsWith(LAST_MONTH)) return false
        break
      case "3months":
        if (tx.date < THREE_MONTHS_AGO) return false
        break
      case "year":
        if (!tx.date.startsWith(CUR_YEAR)) return false
        break
      case "custom":
        if (f.dateFrom && tx.date < f.dateFrom) return false
        if (f.dateTo && tx.date > f.dateTo) return false
        break
    }

    return true
  })
}

export function TransactionsClient({
  initialTransactions,
  accounts,
  members: _members,
  categories,
  banks,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const [txList, setTxList] = useState<Transaction[]>(initialTransactions)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const filteredTx = useMemo(() => applyFilters(txList, filters), [txList, filters])

  const expenseCents = useMemo(
    () => filteredTx.filter((t) => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0),
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

  function handleBulkCategorize(ids: string[], categoryId: string) {
    setTxList((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, categoryId } : t))
    )
    clearSelection()
  }

  function handleBulkSetCommon(ids: string[], isCommon: boolean) {
    setTxList((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, isCommon } : t))
    )
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
            + Nouvelle opération
          </Button>
        </div>
      </div>

      <FilterPanel
        filters={filters}
        accounts={accounts}
        categories={categories}
        onChange={setFilters}
      />

      <div className="tx-count-bar">
        {n} opération{n > 1 ? "s" : ""}
        {" · "}
        <span className={isPrivate ? "private" : ""}>
          {isPrivate ? maskAmount("") : formatCents(Math.abs(expenseCents))}
        </span>
        {" de dépenses"}
      </div>

      <TransactionList
        transactions={filteredTx}
        accounts={accounts}
        categories={categories}
        selected={selected}
        onToggleSelect={toggleSelect}
        onEdit={(tx) => setEditingTx(tx)}
      />

      <BulkBar
        selected={selected}
        txList={txList}
        categories={categories}
        onBulkCategorize={handleBulkCategorize}
        onBulkSetCommon={handleBulkSetCommon}
        onBulkDelete={handleBulkDelete}
        onClearSelection={clearSelection}
      />

      {(showAddModal || editingTx !== null) && (
        <TransactionModal
          editingTx={editingTx}
          accounts={accounts}
          categories={categories}
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
          onImported={handleImported}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
