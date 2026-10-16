"use client"
import { useEffect, useState } from "react"
import { formatCents } from "@/lib/money"

type MemberStat = {
  id: string
  name: string
  short: string
  colorHex: string
  incomeCents: number
  expenseCents: number
  shareOfCommonCents: number
  balanceCents: number
}

type IncomeSplit = {
  memberId: string
  name: string
  pct: number
  amountCents: number
}

type Transfer = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amountCents: number
}

type PartageData = {
  month: string
  members: MemberStat[]
  commonExpensesTotalCents: number
  transfers: Transfer[]
  incomeSplit: IncomeSplit[]
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

type CleMode = "prorata" | "egale" | "perso"

function computeSplit(members: MemberStat[], commonExpensesTotalCents: number, mode: CleMode, perso: Record<string, number>): { memberId: string; pct: number; shareOfCommon: number; balance: number }[] {
  const n = members.length
  return members.map((m) => {
    let pct = 0
    if (mode === "egale") {
      pct = n > 0 ? +(100 / n).toFixed(1) : 0
    } else if (mode === "perso") {
      pct = perso[m.id] ?? (n > 0 ? +(100 / n).toFixed(1) : 0)
    } else {
      // prorata — use original data
      return { memberId: m.id, pct: 0, shareOfCommon: m.shareOfCommonCents, balance: m.balanceCents }
    }
    const shareOfCommon = Math.round(commonExpensesTotalCents * pct / 100)
    const balance = m.incomeCents - m.expenseCents - shareOfCommon
    return { memberId: m.id, pct, shareOfCommon, balance }
  })
}

function computeTransfers(splits: { memberId: string; balance: number }[], members: MemberStat[]): Transfer[] {
  const balances = splits.map(s => ({ ...s, b: s.balance }))
  const transfers: Transfer[] = []
  const debtors = balances.filter(x => x.b < 0).sort((a, b) => a.b - b.b)
  const creditors = balances.filter(x => x.b > 0).sort((a, b) => b.b - a.b)
  const d = debtors.map(x => ({ ...x }))
  const c = creditors.map(x => ({ ...x }))
  let di = 0; let ci = 0
  while (di < d.length && ci < c.length) {
    const debt = Math.abs(d[di].b); const cred = c[ci].b
    const amount = Math.min(debt, cred)
    if (amount > 0) {
      const from = members.find(m => m.id === d[di].memberId)
      const to = members.find(m => m.id === c[ci].memberId)
      if (from && to) transfers.push({ fromId: from.id, fromName: from.name, toId: to.id, toName: to.name, amountCents: amount })
    }
    d[di].b += amount; c[ci].b -= amount
    if (Math.abs(d[di].b) < 1) di++
    if (c[ci].b < 1) ci++
  }
  return transfers
}

export function PartageClient() {
  const [data, setData] = useState<PartageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cleMode, setCleMode] = useState<CleMode>("prorata")
  const [perso, setPerso] = useState<Record<string, number>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const doneKey = `licai-transfers-${new Date().toISOString().slice(0, 7)}`
  const trKey = (t: Transfer, i: number) => `${t.fromId}>${t.toId}:${t.amountCents}:${i}`
  useEffect(() => {
    try { setDone(new Set(JSON.parse(localStorage.getItem(doneKey) ?? "[]") as string[])) } catch { /* stockage indisponible */ }
  }, [doneKey])
  function toggleDone(k: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      try { localStorage.setItem(doneKey, JSON.stringify([...next])) } catch { /* stockage indisponible */ }
      return next
    })
  }

  useEffect(() => {
    fetch("/api/partage")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setData(json.data as PartageData)
        else setError(json.error ?? "Erreur inconnue")
      })
      .catch(() => setError("Impossible de charger les données"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-partage">
        <div className="page-header">
          <h1 className="page-title">Répartition du foyer</h1>
          <div className="page-sub">Revenus, clé de partage et virements à faire</div>
        </div>
        <div className="empty">Chargement…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page-partage">
        <div className="page-header">
          <h1 className="page-title">Répartition du foyer</h1>
          <div className="page-sub">Revenus, clé de partage et virements à faire</div>
        </div>
        <div className="empty">{error ?? "Aucune donnée"}</div>
      </div>
    )
  }

  const { month, members, commonExpensesTotalCents, transfers: apiTransfers, incomeSplit } = data
  const totalIncome = incomeSplit.reduce((s, x) => s + x.amountCents, 0)

  // Derived split based on selected mode
  const computedSplit = computeSplit(members, commonExpensesTotalCents, cleMode, perso)
  const displayTransfers = cleMode === "prorata" ? apiTransfers : computeTransfers(computedSplit, members)

  // Prorata percentages from API for display
  const prorataPcts = Object.fromEntries(incomeSplit.map(s => [s.memberId, s.pct]))

  function persoTotal() {
    return members.reduce((s, m) => s + (perso[m.id] ?? (100 / members.length)), 0)
  }

  return (
    <div className="page-partage">
      {/* Topbar */}
      <div className="page-header">
        <h1 className="page-title">Répartition du foyer</h1>
          <div className="page-sub">Revenus, clé de partage et virements à faire</div>
        <span className="page-subtitle">{monthLabel(month)}</span>
      </div>

      {/* Row 1: two-column grid */}
      <div className="grid-7-5">
        {/* Left: Revenus du foyer */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenus du foyer</span>
            <span className="card-subtitle">{formatCents(totalIncome)}</span>
          </div>
          <div className="split-bar">
            {incomeSplit.map((s) => (
              <div
                key={s.memberId}
                className="split-segment"
                style={{
                  width: `${s.pct}%`,
                  background: s.pct > 0 ? members.find((m) => m.id === s.memberId)?.colorHex ?? "#888" : undefined,
                }}
                title={`${s.name} — ${s.pct}%`}
              />
            ))}
          </div>
          <div className="split-legend">
            {incomeSplit.map((s) => {
              const member = members.find((m) => m.id === s.memberId)
              return (
                <div key={s.memberId} className="split-legend-row">
                  <span className="split-dot" style={{ background: member?.colorHex ?? "#888" }} />
                  <span className="split-legend-name">{s.name}</span>
                  <span className="split-legend-amt">{formatCents(s.amountCents)}</span>
                  <span className="split-legend-pct">{s.pct} %</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Clé de répartition */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clé de répartition</span>
          </div>

          {/* Radio buttons */}
          <div className="cle-radios">
            {(["prorata", "egale", "perso"] as CleMode[]).map(mode => (
              <label key={mode} className={`cle-radio${cleMode === mode ? " active" : ""}`}>
                <input type="radio" name="cle" value={mode} checked={cleMode === mode} onChange={() => setCleMode(mode)} />
                <span className="cle-radio-label">
                  {mode === "prorata" ? "Au prorata des revenus" : mode === "egale" ? "Parts égales" : "Personnalisée"}
                </span>
              </label>
            ))}
          </div>

          {/* Bars */}
          <div className="key-list">
            {members.map((m) => {
              const split = computedSplit.find(s => s.memberId === m.id)
              const pct = cleMode === "prorata" ? (prorataPcts[m.id] ?? 0) : cleMode === "egale" ? +(100 / members.length).toFixed(1) : (perso[m.id] ?? +(100 / members.length).toFixed(1))
              return (
                <div key={m.id} className="key-row">
                  <span className="key-name">{m.name}</span>
                  {cleMode === "perso" ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="key-perso-input"
                      value={perso[m.id] ?? +(100 / members.length).toFixed(1)}
                      onChange={(e) => setPerso(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <div className="key-bar-wrap">
                      <div className="key-bar" style={{ width: `${pct}%`, background: m.colorHex }} />
                    </div>
                  )}
                  <span className="key-pct">{pct.toFixed(1)} %</span>
                </div>
              )
            })}
          </div>

          {cleMode === "perso" && Math.abs(persoTotal() - 100) > 0.5 && (
            <div className="cle-warn">
              <i className="ti ti-alert-triangle" /> Total : {persoTotal().toFixed(1)} % (doit être 100 %)
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Soldes du mois */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Soldes du mois</span>
          <span className="card-subtitle">Dépenses communes : {formatCents(commonExpensesTotalCents)}</span>
        </div>
        <div className="bal-grid">
          {members.map((m) => {
            const split = computedSplit.find(s => s.memberId === m.id)
            const shareOfCommon = split?.shareOfCommon ?? m.shareOfCommonCents
            const balance = split?.balance ?? m.balanceCents
            return (
              <div key={m.id} className="bal-card">
                <div className="bal-head">
                  <span className="mini-av" style={{ background: m.colorHex + "22", color: m.colorHex, borderColor: m.colorHex + "55" }}>
                    {m.short}
                  </span>
                  <span className="bal-name">{m.name}</span>
                </div>
                <div className="bal-nums">
                  <div className="bal-row">
                    <span className="bal-label">Revenus</span>
                    <span className="bal-val pos">{formatCents(m.incomeCents)}</span>
                  </div>
                  <div className="bal-row">
                    <span className="bal-label">Dépenses propres</span>
                    <span className="bal-val neg">{formatCents(m.expenseCents)}</span>
                  </div>
                  <div className="bal-row">
                    <span className="bal-label">Part commune</span>
                    <span className="bal-val neg">{formatCents(shareOfCommon)}</span>
                  </div>
                  <div className="bal-row bal-row-total">
                    <span className="bal-label">Solde</span>
                    <span className={`bal-val ${balance >= 0 ? "pos" : "neg"}`}>{formatCents(balance)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Row 3: Virements suggérés */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Transferts à faire ce mois</span>
          {displayTransfers.length > 0 && <span className="card-subtitle num">{formatCents(displayTransfers.filter((t, i) => !done.has(trKey(t, i))).reduce((sum, t) => sum + t.amountCents, 0))} restants</span>}
        </div>
        {displayTransfers.length === 0 ? (
          <div className="empty">Tout est équilibré ✓</div>
        ) : (
          <div className="tr-list">
            {displayTransfers.map((t, i) => (
              <div key={i} className="tr-row">
                <div className="tr-name">
                  {t.fromName}
                  <span className="tr-arrow"> → </span>
                  {t.toName}
                </div>
                <div className="tr-sub">{t.fromName} doit {formatCents(t.amountCents)} à {t.toName}</div>
                <div className="tr-amt">{formatCents(t.amountCents)}</div>
                <button type="button" className={`btn btn-ghost btn-sm${done.has(trKey(t, i)) ? " is-done" : ""}`} onClick={() => toggleDone(trKey(t, i))}>
                  <i className={`ti ${done.has(trKey(t, i)) ? "ti-circle-check" : "ti-check"}`} /> {done.has(trKey(t, i)) ? "Fait" : "Marquer fait"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
