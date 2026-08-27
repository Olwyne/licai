"use client"
import { useState } from "react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents, maskAmount } from "@/lib/money"
import { Button } from "@/components/ui/Button"
import type { Transaction, Category } from "@/db/schema"

interface Props {
  selected: Set<string>
  txList: Transaction[]
  categories: Category[]
  onBulkCategorize: (ids: string[], categoryId: string) => void
  onBulkSetCommon: (ids: string[], isCommon: boolean) => void
  onBulkDelete: (ids: string[]) => void
  onClearSelection: () => void
}

export function BulkBar({
  selected,
  txList,
  categories,
  onBulkCategorize,
  onBulkSetCommon,
  onBulkDelete,
  onClearSelection,
}: Props) {
  const { private: isPrivate } = usePrivacy()
  const [loading, setLoading] = useState(false)

  const ids = Array.from(selected)
  const selectedTxs = txList.filter((t) => selected.has(t.id))
  const totalCents = selectedTxs.reduce((s, t) => s + t.amountCents, 0)

  async function handleCategorize(categoryId: string) {
    if (!categoryId) return
    setLoading(true)
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/transactions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categoryId }),
          })
        )
      )
      onBulkCategorize(ids, categoryId)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetCommon(isCommon: boolean) {
    setLoading(true)
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/transactions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isCommon }),
          })
        )
      )
      onBulkSetCommon(ids, isCommon)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer ${ids.length} opération(s) ?`)) return
    setLoading(true)
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/transactions/${id}`, { method: "DELETE" })
        )
      )
      onBulkDelete(ids)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bulk-bar${selected.size > 0 ? " on" : ""}`}>
      <span className="bulk-n">
        {selected.size} sélectionnée(s)
        {" · "}
        <span className={isPrivate ? "private" : ""}>
          {isPrivate ? maskAmount("") : formatCents(totalCents)}
        </span>
      </span>

      <div className="bulk-actions">
        <select
          onChange={(e) => {
            if (e.target.value) {
              void handleCategorize(e.target.value)
              e.target.value = ""
            }
          }}
          defaultValue=""
          disabled={loading}
        >
          <option value="" disabled>Catégorie…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <button
          type="button"
          className="amode-btn"
          onClick={() => void handleSetCommon(true)}
          disabled={loading}
        >
          Partagé
        </button>
        <button
          type="button"
          className="amode-btn"
          onClick={() => void handleSetCommon(false)}
          disabled={loading}
        >
          Personnel
        </button>

        <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={loading}>
          Supprimer
        </Button>
        <Button variant="ghost" size="sm" onClick={onClearSelection} disabled={loading}>
          ✕ Annuler
        </Button>
      </div>
    </div>
  )
}
