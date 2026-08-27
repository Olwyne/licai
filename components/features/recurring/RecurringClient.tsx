"use client"
import { useState } from "react"
import { RecurringList } from "./RecurringList"
import { RecurringModal } from "./RecurringModal"
import { Button } from "@/components/ui/Button"
import type { Recurring, Account, Category, Member, Bank } from "@/db/schema"

type KindFilter = "all" | "charge" | "subscription" | "saving" | "paused"

interface Props {
  initialRecurring: Recurring[]
  accounts: Account[]
  categories: Category[]
  members: Member[]
  banks: Bank[]
}

export function RecurringClient({
  initialRecurring,
  accounts,
  categories,
  members,
  banks,
}: Props) {
  const [recurringList, setRecurringList] = useState<Recurring[]>(initialRecurring)
  const [filter, setFilter] = useState<KindFilter>("all")
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Recurring | null>(null)

  function handleAdded(item: Recurring) {
    setRecurringList((prev) => [item, ...prev])
    setShowModal(false)
  }

  function handleUpdated(item: Recurring) {
    setRecurringList((prev) => prev.map((r) => (r.id === item.id ? item : r)))
    setEditTarget(null)
  }

  function handleDeleted(id: string) {
    setRecurringList((prev) => prev.filter((r) => r.id !== id))
    setEditTarget(null)
  }

  return (
    <div className="page-recurrent">
      <div className="page-header">
        <h1 className="page-title">Récurrent</h1>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <i className="ti ti-plus" /> Ajouter
        </Button>
      </div>

      <RecurringList
        items={recurringList}
        accounts={accounts}
        categories={categories}
        banks={banks}
        filter={filter}
        onFilterChange={setFilter}
        onEdit={(item) => setEditTarget(item)}
        onUpdated={handleUpdated}
      />

      {(showModal || editTarget) && (
        <RecurringModal
          item={editTarget}
          accounts={accounts}
          categories={categories}
          onClose={() => {
            setShowModal(false)
            setEditTarget(null)
          }}
          onSaved={editTarget ? handleUpdated : handleAdded}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
