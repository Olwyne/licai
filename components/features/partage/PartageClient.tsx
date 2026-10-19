"use client"
import { useCallback, useEffect, useState } from "react"
import { eur } from "@/lib/finance/format"
import { initials } from "@/lib/finance/format"
import { PageHeader, LoadingOrError } from "@/components/features/finance/ui"

type M = { id: string; name: string; short: string; colorHex: string; incomeCents: number; isChild: boolean }
type A = { id: string; name: string; bank: string; purpose: string; type: string; ownerIds: string[] }
type T = { amountCents: number; accountId: string | null; memberId: string | null; isCommon: boolean; kind: string }
type Data = { members: M[]; accounts: A[]; transactions: T[] }
type Mode = "prorata" | "egal" | "custom"

const pct = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",")
const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", ".")) || 0
const LS = "licai-split"

function Av({ m, size = 26 }: { m: M; size?: number }) {
  return (
    <span className="mini-av" style={{ width: size, height: size, fontSize: Math.round(size / 2.5), background: `${m.colorHex}22`, color: m.colorHex, borderColor: `${m.colorHex}55` }}>
      {initials(m.name)}
    </span>
  )
}

export function PartageClient() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("prorata")
  const [custom, setCustom] = useState<Record<string, number>>({})
  const [done, setDone] = useState<string[]>([])
  const month = new Date().toISOString().slice(0, 7)

  const load = useCallback(() => {
    fetch("/api/partage").then((r) => r.json()).then((j) => (j.data ? setData(j.data as Data) : setError(j.error ?? "Erreur inconnue")))
      .catch(() => setError("Impossible de charger les données"))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS) ?? "{}") as { mode?: Mode; custom?: Record<string, number> }
      if (s.mode) setMode(s.mode)
      if (s.custom) setCustom(s.custom)
      setDone(JSON.parse(localStorage.getItem(`licai-transfers-${month}`) ?? "[]") as string[])
    } catch { /* stockage indisponible */ }
  }, [month])
  const persist = (m: Mode, c: Record<string, number>) => { try { localStorage.setItem(LS, JSON.stringify({ mode: m, custom: c })) } catch { /* ignoré */ } }

  if (!data) return <LoadingOrError title="Répartition du foyer" sub="Revenus, clé de partage et virements à faire" error={error ?? ""} />

  const { members, accounts, transactions } = data
  const eurOf = (c: number) => c / 100
  const acct = (id: string | null) => accounts.find((a) => a.id === id)
  const earners = members.filter((m) => !m.isChild && m.incomeCents > 0)
  const totalIncome = members.reduce((s, m) => s + eurOf(m.incomeCents), 0)

  // Revenu détecté : opérations positives attribuées au membre, ou sur un compte dont il est seul titulaire
  const detected = (mid: string) => transactions.filter((t) => {
    if (t.amountCents <= 0 || t.kind === "transfer") return false
    if (t.memberId) return t.memberId === mid
    const a = acct(t.accountId)
    return !!a && a.ownerIds.length === 1 && a.ownerIds[0] === mid
  }).reduce((s, t) => s + eurOf(t.amountCents), 0)

  // Clé de répartition
  const keys: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]))
  const base = earners.length ? earners : members.filter((m) => !m.isChild)
  if (mode === "prorata") { const tot = base.reduce((s, m) => s + m.incomeCents, 0) || 1; base.forEach((m) => { keys[m.id] = (m.incomeCents / tot) * 100 }) }
  else if (mode === "egal") base.forEach((m) => { keys[m.id] = 100 / base.length })
  else { const sum = Object.values(custom).reduce((s, v) => s + v, 0) || 1; Object.entries(custom).forEach(([id, v]) => { if (id in keys) keys[id] = (v / sum) * 100 }) }

  // Dépenses communes (30 jours) et soldes
  const commonTx = transactions.filter((t) => t.amountCents < 0 && t.kind !== "transfer" && t.isCommon)
  const total = commonTx.reduce((s, t) => s + Math.abs(eurOf(t.amountCents)), 0)
  const paidBy = (mid: string) => commonTx.reduce((s, t) => {
    const amt = Math.abs(eurOf(t.amountCents))
    if (t.memberId) return s + (t.memberId === mid ? amt : 0)
    const a = acct(t.accountId)
    return a && a.ownerIds.includes(mid) ? s + amt / a.ownerIds.length : s
  }, 0)
  const rows = members.map((m) => { const due = (total * (keys[m.id] || 0)) / 100; const paid = paidBy(m.id); return { m, due, paid, delta: paid - due } })
    .filter((r) => r.due > 0 || r.paid > 0)

  const target = accounts.find((a) => a.ownerIds.length > 1 && a.type === "checking") ?? accounts[0]
  const transfers = rows.map((r) => ({ m: r.m, amount: -r.delta })).filter((t) => t.amount > 1)
  const totalT = transfers.reduce((s, t) => s + t.amount, 0)

  async function saveIncome(m: M, value: number) {
    await fetch(`/api/members/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthlyIncomeCents: Math.round(value * 100) }) })
    load()
  }
  function toggleDone(id: string) {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id]
    setDone(next)
    try { localStorage.setItem(`licai-transfers-${month}`, JSON.stringify(next)) } catch { /* ignoré */ }
  }
  const setModeP = (m: Mode) => { setMode(m); persist(m, custom) }

  return (
    <div>
      <PageHeader title="Répartition du foyer" sub="Revenus, clé de partage et virements à faire" />
      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenus du foyer · 30 derniers jours</span>
            <span className="card-title num private" style={{ color: "var(--fg-secondary)" }}>{eur(totalIncome)}</span>
          </div>
          <div className="inc-list">
            {members.map((m) => {
              const det = detected(m.id)
              const income = eurOf(m.incomeCents)
              const share = totalIncome ? (income / totalIncome) * 100 : 0
              return (
                <div className="inc-row" key={m.id}>
                  <Av m={m} size={30} />
                  <div className="inc-info">
                    <div className="inc-name">{m.name}</div>
                    <div className="inc-det">
                      {det ? <>Détecté sur la période : <span className="num private">{eur(det)}</span></> : "Aucun revenu détecté sur la période"}
                      {det > 0 && Math.abs(det - income) > 1 && <> · <button className="inc-use" type="button" onClick={() => saveIncome(m, Math.round(det))}>utiliser</button></>}
                    </div>
                  </div>
                  <div className="inc-input">
                    <input className="share-input" key={`${m.id}-${m.incomeCents}`} type="text" inputMode="decimal" defaultValue={income}
                      onBlur={(e) => { const v = num(e.target.value); if (Math.round(v * 100) !== m.incomeCents) saveIncome(m, v) }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }} />
                    <span className="share-pct">€</span>
                  </div>
                  <div className="inc-share num">{pct(share)} %</div>
                </div>
              )
            })}
          </div>
          <div className="field-hint">Les revenus servent de base à la clé de répartition au prorata.</div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Clé de répartition</span></div>
          <div className="key-modes">
            {([["prorata", "Au prorata des revenus"], ["egal", "Parts égales"], ["custom", "Personnalisée"]] as [Mode, string][]).map(([v, l]) => (
              <button key={v} type="button" className={`key-mode${mode === v ? " on" : ""}`} onClick={() => setModeP(v)}>{l}</button>
            ))}
          </div>
          <div className="key-list">
            {members.filter((m) => keys[m.id] > 0 || mode === "custom").map((m) => (
              <div className="key-row" key={m.id}>
                <Av m={m} />
                <span className="key-name">{m.short || m.name}</span>
                {mode === "custom" ? (
                  <>
                    <input className="share-input" type="text" inputMode="numeric" defaultValue={custom[m.id] || 0}
                      onBlur={(e) => { const c = { ...custom, [m.id]: num(e.target.value) }; setCustom(c); persist(mode, c) }} />
                    <span className="share-pct">%</span>
                  </>
                ) : (
                  <span className="key-bar"><span style={{ width: `${keys[m.id]}%`, background: m.colorHex }} /></span>
                )}
                <span className="key-pct num">{pct(keys[m.id])} %</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Dépenses communes · 30 derniers jours</span>
          <span className="card-title num private" style={{ color: "var(--fg-secondary)" }}>{eur(total)} · {commonTx.length} opérations</span>
        </div>
        <div className="bal-grid">
          {rows.map((r) => (
            <div className="bal-card" key={r.m.id}>
              <div className="bal-head"><Av m={r.m} size={28} /><span className="bal-name">{r.m.short || r.m.name}</span><span className="bal-key num">{pct(keys[r.m.id] || 0)} %</span></div>
              <div className="bal-nums">
                <div><div className="pv-lbl">Dû</div><div className="num private bal-val">{eur(r.due)}</div></div>
                <div><div className="pv-lbl">Payé</div><div className="num private bal-val">{eur(r.paid)}</div></div>
                <div><div className="pv-lbl">Solde</div><div className={`num private bal-val ${r.delta >= 0 ? "pos" : "neg"}`}>{(r.delta >= 0 ? "+" : "−") + eur(Math.abs(r.delta))}</div></div>
              </div>
              <div className="bal-note">{r.delta >= 0 ? "a avancé pour le foyer" : "doit compléter sa part"}</div>
            </div>
          ))}
        </div>
        <div className="field-hint">Sont communes les dépenses des comptes partagés et celles marquées comme telles.</div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Transferts à faire ce mois</span>
          <span className="card-title num private" style={{ color: "var(--fg-secondary)" }}>{eur(totalT)}</span>
        </div>
        {transfers.length ? (
          <div className="tr-list">
            {transfers.map((t) => {
              const id = `${t.m.id}-${month}`
              const isDone = done.includes(id)
              return (
                <div className={`tr-row${isDone ? " done" : ""}`} key={id}>
                  <Av m={t.m} size={30} />
                  <div className="tr-info">
                    <div className="tr-name">{t.m.short || t.m.name} → {target ? `${target.bank ? target.bank + " · " : ""}${target.name}` : "compte commun"}</div>
                    <div className="tr-sub">{target?.purpose || "Compte partagé"} · part de {pct(keys[t.m.id] || 0)} % des dépenses communes</div>
                  </div>
                  <div className="tr-amt num private">{eur(t.amount)}</div>
                  <button type="button" className={`tr-btn${isDone ? " on" : ""}`} onClick={() => toggleDone(id)}>
                    <i aria-hidden="true" className={`ti ${isDone ? "ti-circle-check" : "ti-check"}`} /> {isDone ? "Fait" : "Marquer fait"}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="detect-empty"><i aria-hidden="true" className="ti ti-checkbox" /> Les comptes sont équilibrés — aucun virement à faire.</div>
        )}
      </div>
    </div>
  )
}
