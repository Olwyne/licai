"use client"
import { useState } from "react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents, maskAmount } from "@/lib/money"
import type { Transaction, Category, Member } from "@/db/schema"

interface Props {
  selected: Set<string>
  txList: Transaction[]
  categories: Category[]
  members: Member[]
  onBulkPatch: (ids: string[], patch: Partial<Transaction>) => void
  onBulkDelete: (ids: string[]) => void
  onClearSelection: () => void
}

export function BulkBar({ selected, txList, categories, members, onBulkPatch, onBulkDelete, onClearSelection }: Props) {
  const { private: isPrivate } = usePrivacy()
  const [loading, setLoading] = useState(false)
  const ids = Array.from(selected)
  const totalCents = txList.filter((t) => selected.has(t.id)).reduce((s, t) => s + t.amountCents, 0)

  async function patchAll(patch: Partial<Transaction>) {
    setLoading(true)
    try {
      const res = await Promise.all(ids.map((id) => fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })))
      const ok = ids.filter((_, i) => res[i].ok)
      if (ok.length) onBulkPatch(ok, patch)
    } finally { setLoading(false) }
  }

  async function remove() {
    if (!confirm(`Supprimer ${ids.length} opération(s) ?`)) return
    setLoading(true)
    try {
      const res = await Promise.all(ids.map((id) => fetch(`/api/transactions/${id}`, { method: "DELETE" })))
      const ok = ids.filter((_, i) => res[i].ok)
      if (ok.length) onBulkDelete(ok)
    } finally { setLoading(false) }
  }

  return (
    <div className={`bulk-bar${selected.size > 0 ? " on" : ""}`}>
      <span className="bulk-n">{selected.size} sélectionnée{selected.size > 1 ? "s" : ""} · <span className={isPrivate ? "private" : ""}>{isPrivate ? maskAmount("") : formatCents(totalCents)}</span></span>
      <div className="select">
        <select defaultValue="" disabled={loading} onChange={(e) => { if (e.target.value) { void patchAll({ memberId: e.target.value === "__none" ? null : e.target.value }); e.target.value = "" } }}>
          <option value="" disabled>Attribuer à…</option>
          <option value="__none">Non attribué</option>
          {members.filter((m) => !m.isChild).map((m) => <option key={m.id} value={m.id}>{m.short || m.name}</option>)}
        </select>
      </div>
      <div className="select">
        <select defaultValue="" disabled={loading} onChange={(e) => { if (e.target.value) { void patchAll({ categoryId: e.target.value }); e.target.value = "" } }}>
          <option value="" disabled>Catégorie…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void patchAll({ isCommon: true })}><i aria-hidden="true" className="ti ti-users" /> Marquer commune</button>
      <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void patchAll({ isCommon: false })}><i aria-hidden="true" className="ti ti-user" /> Marquer perso</button>
      <div style={{ flex: 1 }} />
      <button className="btn btn-ghost" type="button" style={{ color: "#D85A30" }} disabled={loading} onClick={() => void remove()}><i aria-hidden="true" className="ti ti-trash" /> Supprimer</button>
      <button className="btn btn-ghost" type="button" disabled={loading} onClick={onClearSelection}>Annuler la sélection</button>
    </div>
  )
}
