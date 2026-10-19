"use client"
import { SortTh } from "@/components/ui/TableView"
import { useTableView } from "@/lib/use-table-view"
import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import type { DashboardData } from "@/lib/server/dashboard-data"
import type { Series } from "@/lib/server/dashboard-series"
import { ASSETS, computePortfolio } from "@/lib/finance/invest"
import { eur, eurS, pc, pcS } from "@/lib/finance/format"
import { useQuoteOverrides, useStoredProfile } from "@/components/features/finance/quotes"
import { Kpi, PageHeader, StatRow } from "@/components/features/finance/ui"
import { DonutChart } from "@/components/charts/DonutChart"
import { FlowBars, SoldeLine } from "@/components/features/dashboard/DashCharts"

export type { DashboardData }

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const dLabel = (d: string) => { const [, m, day] = d.split("-").map(Number); return `${day} ${MONTHS[m - 1]}` }
const addDays = (s: string, n: number) => { const [y, m, d] = s.split("-").map(Number); const x = new Date(y, m - 1, d + n, 12); return x.toISOString().slice(0, 10) }
const REC_KINDS: Record<string, { label: string; color: string }> = {
  charge: { label: "Charge fixe", color: "#D85A30" },
  subscription: { label: "Abonnement", color: "#7C6BD6" },
  insurance: { label: "Assurance", color: "#378ADD" },
  saving: { label: "Épargne auto", color: "#1D9E75" },
}

const PERIODS: { key: string; label: string }[] = [
  { key: "j", label: "1 jour" }, { key: "s", label: "1 semaine" }, { key: "w", label: "1 mois" },
  { key: "m", label: "6 mois" }, { key: "t", label: "Trimestres" }, { key: "a", label: "Années" },
]

function RangeModal({ anchor, initial, onClose, onApply }: {
  anchor: string; initial: { from: string; to: string } | null; onClose: () => void; onApply: (r: { from: string; to: string }) => void
}) {
  const [from, setFrom] = useState(initial?.from ?? addDays(anchor, -13))
  const [to, setTo] = useState(initial?.to ?? anchor)
  const [days, setDays] = useState<number | null>(null)
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>Choisir une période</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field"><label>Du</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setDays(null) }} /></div>
            <div className="field"><label>Au</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setDays(null) }} /></div>
          </div>
          <div className="chips">
            {[[7, "7 derniers jours"], [14, "14 jours"], [30, "30 jours"], [90, "90 jours"], [365, "12 mois"]].map(([n, l]) => (
              <button key={n} className={`chip ${days === n ? "active" : ""}`} onClick={() => { setTo(anchor); setFrom(addDays(anchor, -(Number(n) - 1))); setDays(Number(n)) }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!from || !to || from > to} onClick={() => onApply({ from, to })}><i aria-hidden="true" className="ti ti-check" /> Appliquer</button>
        </div>
      </div>
    </div>
  )
}

export function DashboardClient({ initialData: d }: { initialData: DashboardData }) {
  const [period, setPeriod] = useState("m")
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [series, setSeries] = useState<Series>(d.series)
  const profile = useStoredProfile()
  const quotes = useQuoteOverrides()

  const loadSeries = useCallback(async (p: string, range?: { from: string; to: string }) => {
    if (p === "m" && !range) { setSeries(d.series); return }
    const q = new URLSearchParams({ period: p, anchor: d.anchor })
    if (range) { q.set("from", range.from); q.set("to", range.to) }
    try {
      const res = await fetch(`/api/dashboard/series?${q}`)
      if (res.ok) setSeries(((await res.json()) as { data: Series }).data)
    } catch { /* garde la série précédente */ }
  }, [d.anchor, d.series])

  const choose = (p: string) => { setPeriod(p); void loadSeries(p) }
  const applyRange = (r: { from: string; to: string }) => { setCustom(r); setPeriod("c"); setRangeOpen(false); void loadSeries("c", r) }

  // tri du détail mensuel (l'ordre d'origine est chronologique)
  const monthView = useTableView(d.monthly, {
    mois: (r) => d.monthly.indexOf(r), rev: (r) => r.rev, courant: (r) => r.courant, credits: (r) => r.credits, saving: (r) => r.saving, rate: (r) => r.rate, solde: (r) => r.solde, var: (r) => r.varPct,
  })

  const m = useMemo(() => {
    const ctx = d.ctx
    const S = computePortfolio(ctx, profile, quotes)
    const immo = ctx.properties.reduce((s, p) => s + p.value, 0)
    const immoAchat = ctx.properties.reduce((s, p) => s + p.price, 0)
    const dette = ctx.loans.reduce((s, l) => s + l.left, 0)
    const net = d.cash + S.total + immo - dette
    const rented = ctx.properties.filter((p) => p.rentMonthly > 0)
    const rentValue = rented.reduce((s, p) => s + p.value, 0)
    const rendement = rentValue ? (rented.reduce((s, p) => s + p.rentMonthly * 12, 0) / rentValue) * 100 : 0
    const tauxMoyen = dette ? ctx.loans.reduce((s, l) => s + l.rate * l.left, 0) / dette : 0
    const coutCredit = ctx.loans.reduce((s, l) => s + (l.left * l.rate) / 100 / 12, 0)
    return { S, immo, immoAchat, dette, net, rendement, tauxMoyen, coutCredit }
  }, [d.ctx, d.cash, profile, quotes])

  const { S } = m
  const over = d.budgets.filter((b) => b.spent > b.limit)
  const totalCats = d.categories.reduce((s, c) => s + c.amount, 0)
  const maxCat = Math.max(1, ...d.categories.map((c) => Math.max(c.amount, c.limit)))
  const goalsCur = d.goals.reduce((s, g) => s + g.current, 0)
  const goalsTar = d.goals.reduce((s, g) => s + g.target, 0)
  const rangeLabel = period === "c" && custom ? `${dLabel(custom.from)} → ${dLabel(custom.to)}` : series.rangeLabel
  const sumRev = series.rev.reduce((a, b) => a + b, 0) / 100
  const sumDep = series.dep.reduce((a, b) => a + b, 0) / 100
  const tot = d.monthly.reduce((a, r) => ({ rev: a.rev + r.rev, courant: a.courant + r.courant, credits: a.credits + r.credits, dep: a.dep + r.dep, saving: a.saving + r.saving }), { rev: 0, courant: 0, credits: 0, dep: 0, saving: 0 })
  const topPlacements = S.cls.slice(0, 3)
  const perf = d.ctx.history.length > 1 && d.ctx.history[0].value > 0 ? (S.total / d.ctx.history[0].value - 1) * 100 : null
  const bench = (() => { const b = d.ctx.history[d.ctx.history.length - 1]?.bench; return b != null ? b - 100 : null })()
  const splitTot = d.split.members.reduce((s, x) => s + x.income, 0)

  const signals: { tone: "up" | "down" | "neutral"; icon: string; title: string; sub: string }[] = []
  over.forEach((b) => signals.push({ tone: "down", icon: "ti-alert-triangle", title: `Budget ${b.label} dépassé de ${eur(b.spent - b.limit)}`, sub: `${Math.round((b.spent / b.limit) * 100)} % du plafond consommé` }))
  if (d.tauxEndett != null && d.tauxEndett > 35) signals.push({ tone: "down", icon: "ti-percentage", title: `Taux d'endettement à ${pc(d.tauxEndett)}`, sub: `${eur(d.mensualites)} de mensualités pour ${eur(d.salaires + d.loyers || d.revenus)} de revenus` })
  if (d.revenus > 0) signals.push({ tone: d.tauxEpargne >= 20 ? "up" : "neutral", icon: "ti-trending-up", title: `Taux d'épargne de ${pc(d.tauxEpargne)}`, sub: `${eur(d.epargne)} mis de côté ce mois` })
  if (m.immo > m.immoAchat) signals.push({ tone: "up", icon: "ti-home-stats", title: `Plus-value immobilière de ${eur(m.immo - m.immoAchat)}`, sub: `${d.ctx.properties.length} bien${d.ctx.properties.length > 1 ? "s" : ""} estimé${d.ctx.properties.length > 1 ? "s" : ""}` })
  if (d.paused.length) signals.push({ tone: "neutral", icon: "ti-player-pause", title: `${d.paused.length} abonnement${d.paused.length > 1 ? "s" : ""} en pause`, sub: d.paused.join(", ") })
  if (d.depenses > 0) signals.push({ tone: "neutral", icon: "ti-cash", title: `Couverture de ${(d.cash / d.depenses).toFixed(1)} mois de dépenses`, sub: `trésorerie ${eur(d.cash)} vs ${eur(d.depenses)} / mois` })

  return (
    <div className="page-overview">
      <PageHeader title={`Bonjour${d.firstName ? `, ${d.firstName}` : ""} 👋`} sub={`Tableau de bord & rapports du foyer — ${d.monthLabel}`} />

      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          {PERIODS.map((p) => (
            <button key={p.key} className={`chip${period === p.key ? " active" : ""}`} onClick={() => choose(p.key)}>{p.label}</button>
          ))}
          <button className={`chip${period === "c" ? " active" : ""}`} onClick={() => setRangeOpen(true)}><i aria-hidden="true" className="ti ti-calendar-month" /> Période…</button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="ov-range-label">{rangeLabel}</span>
        <button className="btn btn-ghost" onClick={() => window.open(`/rapport?month=${d.month}`, "_blank")}><i aria-hidden="true" className="ti ti-download" /> Exporter le rapport</button>
      </div>

      <div className="metrics">
        <Kpi label={`Trésorerie · ${d.nbAccounts} comptes`} icon="ti-wallet" color="#1D9E75" value={eur(d.cash)}
          sub={d.cashPrevMonthPct != null ? <><i aria-hidden="true" className="ti ti-trending-up" /> {pcS(d.cashPrevMonthPct)} vs mois précédent</> : d.monthLabel} tone={d.cashPrevMonthPct != null && d.cashPrevMonthPct < 0 ? "down" : "up"} />
        <Kpi label="Revenus du foyer" icon="ti-arrow-down-left" color="#1D9E75" value={eur(d.revenus)}
          sub={d.salaires + d.loyers > 0 ? `Salaires ${eur(d.salaires)} · loyers ${eur(d.loyers)}` : "Entrées du mois"} />
        <Kpi label={`Dépenses · ${d.monthLabel.split(" ")[0]}`} icon="ti-arrow-up-right" color="#D85A30" value={eur(d.depenses)} sub={`${d.nbExpenseTx} opérations`} />
        <Kpi label="Épargne du mois" icon="ti-pig-money" color="#378ADD" value={eur(d.epargne)}
          sub={<><i aria-hidden="true" className="ti ti-percentage" /> Taux d&apos;épargne {pc(d.tauxEpargne)}</>} tone={d.tauxEpargne >= 20 ? "up" : "down"} />
      </div>
      <div className="metrics">
        <Kpi label="Reste à vivre / jour" icon="ti-calendar-dollar" color="#EF9F27" value={eur(d.resteJour)} sub="Après charges fixes et crédits" />
        <Kpi label="Charges fixes" icon="ti-repeat" color="#7C6BD6" value={eur(d.chargesFixes)} sub={`${d.nbRecurring} prélèvements actifs`} />
        <Kpi label="Taux d'endettement" icon="ti-percentage" color="#D4537E" value={d.tauxEndett != null ? pc(d.tauxEndett) : "—"}
          sub={d.tauxEndett != null && d.tauxEndett > 35 ? <><i aria-hidden="true" className="ti ti-alert-triangle" /> Seuil 35 % dépassé</> : "Sous le seuil de 35 %"} tone={d.tauxEndett != null && d.tauxEndett > 35 ? "down" : "up"} />
        <Kpi label="Patrimoine net" icon="ti-home-stats" color="#888780" value={eur(m.net)} sub={`Dettes ${eur(m.dette)} déduites`} tone="up" />
      </div>

      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Placements financiers</span><Link className="card-link" href="/placements">Analyser</Link></div>
        {S.pos.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>Aucun placement renseigné.</div>
        ) : (
          <div className="ov-inv-grid">
            <div><div className="inv-lbl">Valorisation</div><div className="ov-inv-val num private">{eur(S.total)}</div>
              <div className={`metric-sub ${S.dayEur >= 0 ? "up" : "down"}`}>{pcS(S.total ? (S.dayEur / S.total) * 100 : 0, 2)} aujourd&apos;hui</div></div>
            <div><div className="inv-lbl">± value latente</div><div className={`ov-inv-val num private ${S.pv >= 0 ? "pos" : "neg"}`}>{eurS(S.pv)}</div>
              <div className="metric-sub neutral">{pcS(S.paid ? (S.pv / S.paid) * 100 : 0)} des versements</div></div>
            <div><div className="inv-lbl">Perf. 6 mois</div><div className="ov-inv-val num">{perf != null ? pcS(perf) : "—"}</div>
              <div className="metric-sub neutral">{bench != null ? `MSCI World (EUR) ${pcS(bench)}` : "Historique en cours"}</div></div>
            <div><div className="inv-lbl">Répartition</div>
              <div className="ov-inv-mix">{topPlacements.map((c) => (
                <span key={c.k}><span className="legend-dot" style={{ background: ASSETS[c.k as keyof typeof ASSETS]?.color, display: "inline-block" }} />{ASSETS[c.k as keyof typeof ASSETS]?.label ?? c.k} {pc(c.w, 0)}</span>
              ))}</div></div>
          </div>
        )}
        <div className="disclaimer sm"><i aria-hidden="true" className="ti ti-info-circle" /> <span>Analyses informatives — ni conseil en investissement, ni conseil fiscal. Risque de perte en capital ; décisions et conséquences à votre seule charge.</span></div>
      </div>

      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenus vs dépenses</span>
            <span className="card-sub num">Revenus {eur(sumRev)} · dépenses {eur(sumDep)} · épargne {sumRev - sumDep < 0 ? "− " : ""}{eur(Math.abs(sumRev - sumDep))}</span>
          </div>
          <div className="chart-box" style={{ height: 250 }}>
            <FlowBars labels={series.labels} rev={series.rev.map((v) => v / 100)} dep={series.dep.map((v) => v / 100)} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Répartition · {d.monthLabel.split(" ")[0]}</span></div>
          {d.categories.length === 0 ? <div className="empty" style={{ padding: 20 }}>Aucune dépense ce mois</div> : (
            <div className="chart-wrap" style={{ flexDirection: "column", gap: 18 }}>
              <div style={{ width: 170, height: 170, position: "relative" }}>
                <DonutChart slices={d.categories.slice(0, 8).map((c) => ({ label: c.label, value: c.amount, color: c.colorHex }))} />
                <div className="donut-center"><div><div className="dc-val num private">{eur(totalCats)}</div><div className="dc-lbl">dépensé</div></div></div>
              </div>
              <div className="legend" style={{ width: "100%" }}>
                {d.categories.map((c) => (
                  <div className="legend-item" key={c.categoryId}>
                    <span className="legend-dot" style={{ background: c.colorHex }} />
                    <span className="legend-name">{c.label}</span>
                    <span className="legend-val num">{pc(totalCats ? (c.amount / totalCats) * 100 : 0, 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Trésorerie · 30 derniers jours</span><Link className="card-link" href="/comptes">Comptes</Link></div>
          <div className="chart-box" style={{ height: 218 }}><SoldeLine labels={d.daily.labels} values={d.daily.values.map((v) => v / 100)} /></div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Chiffres clés</span></div>
          <div className="stat-list">
            <StatRow label="Dépense moyenne / jour" value={eur(d.keys.avgPerDay)} hint="dépenses du mois ÷ jours écoulés" />
            <StatRow label="Panier moyen" value={eur(d.keys.panier)} hint={`${d.keys.nbExpense} opérations`} />
            <StatRow label="Plus grosse dépense" value={d.keys.biggest ? eur(d.keys.biggest.amount) : "—"} hint={d.keys.biggest?.name} />
            <StatRow label="Journée la plus dépensière" value={d.keys.worstDay ? eur(d.keys.worstDay.amount) : "—"} hint={d.keys.worstDay ? dLabel(d.keys.worstDay.date) : undefined} />
            <StatRow label="Jours sans dépense" value={`${d.keys.daysNoSpend} / ${d.keys.span}`} hint="sur la période importée" />
            <StatRow label="Revenus encaissés" value={eur(d.keys.incomeCashed)} hint={`${d.keys.nbIncome} entrées`} />
            <StatRow label="Budget consommé" value={pc(d.keys.budgetPct, 0)} hint={`${eur(d.keys.budgetSpent)} sur ${eur(d.keys.budgetLimit)}`} />
            <StatRow label="Dépenses annualisées" value={eur(d.keys.annualized)} hint="au rythme actuel" />
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Dépenses par catégorie · {d.monthLabel.split(" ")[0]}</span><Link className="card-link" href="/budget">Modifier les plafonds</Link></div>
        <div>
          {d.categories.length === 0 && <div className="empty" style={{ padding: 20 }}>Aucune dépense ce mois</div>}
          {d.categories.map((c) => {
            const varPc = c.prev ? ((c.amount - c.prev) / c.prev) * 100 : 0
            const up = varPc > 0
            const overLim = c.limit > 0 && c.amount > c.limit
            const warn = c.limit > 0 && c.amount / c.limit >= 0.9
            return (
              <div className="cat-row" key={c.categoryId}>
                <span className="cat-name">
                  <span className="tx-icon" style={{ width: 26, height: 26, borderRadius: 8, fontSize: 14, background: `${c.colorHex}22`, color: c.colorHex }}><i aria-hidden="true" className={`ti ${c.icon}`} /></span>{c.label}
                </span>
                <div className="cat-track">
                  <div className="cat-fill" style={{ width: `${Math.round((c.amount / maxCat) * 100)}%`, background: c.colorHex }} />
                  {c.limit > 0 && <span className="cat-cap" style={{ left: `${Math.min(100, Math.round((c.limit / maxCat) * 100))}%` }} title={`Plafond ${eur(c.limit)}`} />}
                </div>
                <span className="cat-val num private">{eur(c.amount)}</span>
                <span className="cat-pc num">{pc(totalCats ? (c.amount / totalCats) * 100 : 0, 0)}</span>
                <span className={`cat-var num ${up ? "neg" : "pos"}`}>{c.prev ? <><i aria-hidden="true" className={`ti ti-${up ? "arrow-up-right" : "arrow-down-right"}`} />{pc(Math.abs(varPc), 0)}</> : "—"}</span>
                <span className={`cat-state ${overLim ? "over" : warn ? "warn" : "ok"}`}>{c.limit <= 0 ? "—" : overLim ? "dépassé" : warn ? "limite" : "ok"}</span>
              </div>
            )
          })}
          <div className="inv-note"><span className="cat-cap-demo" /> repère = plafond mensuel · variation vs mois précédent</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Détail mensuel</span><span className="card-sub">Revenus, dépenses, épargne et trésorerie</span></div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr>
              <SortTh view={monthView} col="mois">Mois</SortTh><SortTh view={monthView} col="rev" className="r">Revenus</SortTh><SortTh view={monthView} col="courant" className="r">Courant</SortTh><SortTh view={monthView} col="credits" className="r">Crédits</SortTh>
              <SortTh view={monthView} col="saving" className="r">Épargne</SortTh><SortTh view={monthView} col="rate" className="r">Taux</SortTh><SortTh view={monthView} col="solde" className="r">Trésorerie</SortTh><SortTh view={monthView} col="var" className="r">Var.</SortTh>
            </tr></thead>
            <tbody>
              {monthView.rows.map((r, i) => (
                <tr key={r.month + i} className={r === d.monthly[d.monthly.length - 1] ? "cur" : undefined}>
                  <td>{r.month}{r === d.monthly[d.monthly.length - 1] ? <> <span className="tag-now">en cours</span></> : null}</td>
                  <td className="r num private">{eur(r.rev)}</td>
                  <td className="r num private">{eur(r.courant)}</td>
                  <td className="r num private">{eur(r.credits)}</td>
                  <td className={`r num private ${r.saving > 0 ? "pos" : "neg"}`}>{r.saving < 0 ? "− " : ""}{eur(Math.abs(r.saving))}</td>
                  <td className="r num">{pc(r.rate, 0)}</td>
                  <td className="r num private">{eur(r.solde)}</td>
                  <td className={`r num ${r.varPct != null && r.varPct > 0 ? "pos" : "neg"}`}>{r.varPct == null ? "—" : (r.varPct > 0 ? "+" : "−") + pc(Math.abs(r.varPct), 1)}</td>
                </tr>
              ))}
              <tr className="tot">
                <td>Total {d.monthly.length} mois</td>
                <td className="r num private">{eur(tot.rev)}</td>
                <td className="r num private">{eur(tot.courant)}</td>
                <td className="r num private">{eur(tot.credits)}</td>
                <td className="r num private pos">{eur(tot.saving)}</td>
                <td className="r num">{pc(tot.rev ? (tot.saving / tot.rev) * 100 : 0, 0)}</td>
                <td className="r num private">{eur(d.cash)}</td>
                <td className="r" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Évolution de la trésorerie</span></div>
          <div className="chart-box" style={{ height: 215 }}><SoldeLine labels={series.labels} values={series.solde.map((v) => v / 100)} color="#378ADD" /></div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Répartition du foyer</span><Link className="card-link" href="/partage">Détails</Link></div>
          <div>
            {d.split.members.map((s) => (
              <div className="split-row" key={s.id}>
                <span className="split-who"><span className="avatar" style={{ width: 26, height: 26, fontSize: 11, background: `${s.color}22`, color: s.color }}>{s.short[0]}</span>{s.short}</span>
                <div className="cat-track"><div className="cat-fill" style={{ width: `${s.incomePct}%`, background: s.color }} /></div>
                <span className="split-pc num">{pc(s.incomePct, 0)}</span>
                <span className="split-amt num private">{eur(s.share)}</span>
              </div>
            ))}
            <div className="stat-row" style={{ marginTop: 10 }}>
              <span className="stat-lbl">Charges communes du foyer<span className="stat-hint">crédits {eur(d.split.loans)} + récurrent {eur(d.split.recurring)}</span></span>
              <span className="stat-val num private">{eur(d.split.commun)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-lbl">Clé de partage<span className="stat-hint">au prorata des revenus</span></span>
              <span className="stat-val num">{splitTot ? d.split.members.filter((x) => x.income).map((x) => pc(x.incomePct, 0)).join(" / ") : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Budget du mois</span><Link className="card-link" href="/budget">Modifier</Link></div>
          <div>
            {d.budgets.length === 0 && <div className="empty" style={{ padding: 20 }}>Aucun budget ce mois</div>}
            {d.budgets.map((b) => {
              const real = b.limit ? Math.round((b.spent / b.limit) * 100) : 0
              const state = real > 100 ? "over" : real >= 90 ? "warn" : "ok"
              const rest = b.limit - b.spent
              return (
                <div className="budget-item" key={b.categoryId}>
                  <div className="budget-row"><span className="budget-name"><span className="budget-dot" style={{ background: b.colorHex }} />{b.label}</span>
                    <span className="budget-amounts"><b className="private">{eur(b.spent)}</b> / {eur(b.limit)}</span></div>
                  <div className="bar-bg"><div className={`bar-fill ${state}`} style={{ width: `${Math.min(100, real)}%` }} /></div>
                  <div className="budget-row" style={{ marginTop: 5 }}>
                    <span className="budget-amounts num">{real} %</span>
                    <span className="budget-amounts num" style={{ color: rest < 0 ? "var(--danger)" : "var(--fg-secondary)" }}>{rest < 0 ? `dépassé de ${eur(rest)}` : `${eur(rest)} restants`}</span>
                  </div>
                </div>
              )
            })}
            {over.length > 0 && <div className="alert"><i aria-hidden="true" className="ti ti-alert-triangle" /> {over.length} budget{over.length > 1 ? "s" : ""} dépassé{over.length > 1 ? "s" : ""} · {eur(over.reduce((s, b) => s + (b.spent - b.limit), 0))} au-delà des plafonds</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Plus grosses dépenses</span><Link className="card-link" href="/transactions">Tout voir</Link></div>
          <div>
            {d.top.length === 0 && <div className="empty" style={{ padding: 20 }}>Aucune dépense ce mois</div>}
            {d.top.map((t) => (
              <div className="top-row" key={t.id}>
                <div className="tx-icon" style={{ width: 30, height: 30, borderRadius: 9, fontSize: 15, background: `${t.categoryColor}22`, color: t.categoryColor }}><i aria-hidden="true" className={`ti ${t.categoryIcon}`} /></div>
                <div className="tx-info"><div className="tx-name">{t.name}</div><div className="tx-meta"><span className="tx-cat-tag">{t.categoryLabel}</span>{dLabel(t.date)}</div></div>
                <div><div className="tx-amount num private neg">{eur(t.amount)}</div><div className="top-share num">{pc(t.pct, 0)} du total</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Objectifs à court terme</span><Link className="card-link" href="/objectifs">Tous les objectifs</Link></div>
          <div>
            {d.goals.length === 0 ? <div className="empty" style={{ padding: 20 }}>Aucun objectif à court terme</div> : (
              <>
                <div className="stat-row"><span className="stat-lbl">Total épargné<span className="stat-hint">{d.goals.length} objectifs à court terme · reste {eur(goalsTar - goalsCur)}</span></span><span className="stat-val num private">{eur(goalsCur)} / {eur(goalsTar)}</span></div>
                <div className="bar-bg" style={{ margin: "10px 0 14px" }}><div className="bar-fill ok" style={{ width: `${goalsTar ? Math.round((goalsCur / goalsTar) * 100) : 0}%` }} /></div>
                {d.goals.map((g) => {
                  const p = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0
                  return (
                    <div className="env-row" key={g.id}><span className="env-name">{g.emoji} {g.name}</span>
                      <div className="cat-track"><div className="cat-fill" style={{ width: `${p}%`, background: p >= 100 ? "var(--success,#1D9E75)" : "#7C6BD6" }} /></div>
                      <span className="env-pc num">{p} %</span><span className="env-amt num private">{eur(g.current)}</span></div>
                  )
                })}
                <div className="stat-row" style={{ marginTop: 10 }}><span className="stat-lbl">Effort mensuel pour tenir les échéances<span className="stat-hint">épargne auto actuelle {eur(d.autoSaving)}</span></span><span className="stat-val num private">{eur((goalsTar - goalsCur) / 9)}</span></div>
              </>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Prochaines échéances</span><Link className="card-link" href="/recurrent">Récurrent</Link></div>
          <div>
            {d.next.length === 0 && <div className="empty" style={{ padding: 20 }}>Aucune échéance à venir</div>}
            {d.next.map((r) => {
              const k = REC_KINDS[r.kind] ?? REC_KINDS.charge
              return (
                <div className="next-row" key={r.id}><span className="next-day num">{r.day}</span>
                  <div className="tx-info"><div className="tx-name">{r.name}</div><div className="tx-meta"><span className="tx-cat-tag" style={{ color: k.color, borderColor: `${k.color}44` }}>{k.label}</span>{r.accountLabel ? `${r.accountLabel} · ` : ""}{r.frequency}</div></div>
                  <div className="tx-amount num private neg">{eur(r.amount)}</div></div>
              )
            })}
            {d.next.length > 0 && <div className="stat-row" style={{ marginTop: 8 }}><span className="stat-lbl">Prélèvements à venir ce mois<span className="stat-hint">hors mensualités de crédit ({eur(d.mensualites)})</span></span><span className="stat-val num private">{eur(d.dueThisMonth)}</span></div>}
          </div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Patrimoine &amp; dettes</span><Link className="card-link" href="/patrimoine">Patrimoine</Link></div>
          <div className="stat-list">
            <StatRow label="Immobilier estimé" value={eur(m.immo)} hint={`${d.ctx.properties.length} bien${d.ctx.properties.length > 1 ? "s" : ""} · ${d.ctx.properties.reduce((s, p) => s + (p.surface ?? 0), 0)} m²`} />
            <StatRow label="Plus-value latente" value={"+ " + eur(m.immo - m.immoAchat)} hint={`${pc(m.immoAchat ? ((m.immo - m.immoAchat) / m.immoAchat) * 100 : 0, 1)} vs prix d'achat`} />
            <StatRow label="Placements financiers" value={eur(S.total)} hint="actions, ETF, fonds euro, crypto" />
            <StatRow label="Trésorerie" value={eur(d.cash)} hint={`${d.nbAccounts} comptes`} />
            <StatRow label="Capital restant dû" value={"− " + eur(m.dette)} hint={`${d.ctx.loans.length} crédit${d.ctx.loans.length > 1 ? "s" : ""}`} />
            <StatRow label="Patrimoine net" value={eur(m.net)} hint="actifs − dettes" />
            <StatRow label="Rendement locatif brut" value={pc(m.rendement, 2)} hint={`${eur(d.loyers)} de loyer / mois`} />
            <StatRow label="Taux moyen des crédits" value={pc(m.tauxMoyen, 2)} hint="pondéré par le capital" />
            <StatRow label="Coût du crédit / mois" value={eur(m.coutCredit)} hint="part d'intérêts estimée" />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Signaux du mois</span></div>
          <div>
            {signals.length === 0 && <div className="empty" style={{ padding: 20 }}>Rien à signaler</div>}
            {signals.map((s, i) => (
              <div className={`sig-row ${s.tone}`} key={i}><i aria-hidden="true" className={`ti ${s.icon}`} /><div><div className="sig-title">{s.title}</div><div className="sig-sub">{s.sub}</div></div></div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Dernières transactions</span><Link className="card-link" href="/transactions">Voir tout</Link></div>
        <div>
          {d.lastTx.length === 0 && <div className="empty" style={{ padding: 20 }}>Aucune transaction</div>}
          {d.lastTx.map((t) => {
            const today = new Date().toISOString().slice(0, 10)
            const when = t.date === today ? "Aujourd'hui" : t.date === addDays(today, -1) ? "Hier" : dLabel(t.date)
            return (
              <div className="tx-row" key={t.id}>
                <div className="tx-icon" style={{ background: `${t.categoryColor}22`, color: t.categoryColor }}><i aria-hidden="true" className={`ti ${t.categoryIcon}`} /></div>
                <div className="tx-info"><div className="tx-name">{t.name}</div><div className="tx-meta"><span className="tx-cat-tag">{when}</span>{t.accountName}</div></div>
                <div className={`tx-amount num private ${t.amount >= 0 ? "pos" : "neg"}`}>{t.amount >= 0 ? "+" : "−"}{eur(Math.abs(t.amount))}</div>
              </div>
            )
          })}
        </div>
      </div>

      {rangeOpen && <RangeModal anchor={d.anchor} initial={custom} onClose={() => setRangeOpen(false)} onApply={applyRange} />}
    </div>
  )
}
