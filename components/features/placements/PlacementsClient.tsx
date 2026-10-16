"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Line } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js"
import type { AssetClass, CtxHolding, CtxInvAccount, FinanceContext, InvKind } from "@/lib/finance/types"
import {
  ASSETS, INV_KINDS, PROFILES, ZONES, allocationRows, byAcct, computePortfolio, feeRows, group, investAdvice, investTaxRows, usedCeiling,
  type PortfolioState, type ProfileKey,
} from "@/lib/finance/invest"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { eur, eurS, num2, pc, pcS } from "@/lib/finance/format"
import {
  loadProfile, loadQuotes, overrides, quoteTickers, refreshLive, saveProfile, saveQuotes, srcLabel, type QuoteMode, type QuoteState,
} from "@/components/features/finance/quotes"
import { useThemeTick } from "@/components/features/finance/useThemeTick"
import { useFinanceContext } from "@/components/features/finance/useFinanceContext"
import { AdviceRow, Disclaimer, Kpi, LoadingOrError, MiniAv, PageHeader, StatRow } from "@/components/features/finance/ui"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const PAL = ["#1D9E75", "#378ADD", "#7C6BD6", "#EF9F27", "#D4537E", "#D85A30", "#888780"]
const hash = (s: string) => PAL[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length]
const num = (v: string) => parseFloat((v || "0").replace(/\s/g, "").replace(",", ".")) || 0

// ─── Petits blocs ────────────────────────────────────────────────────────────

function Bars({ rows, color }: { rows: { k: string; v: number; w: number }[]; color: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  if (!rows.length) return <div className="empty" style={{ padding: 20 }}>Aucune donnée</div>
  return (
    <>
      {rows.map((r) => (
        <div className="bd-row" key={r.k}>
          <span className="bd-name">{r.k}</span>
          <div className="cat-track"><div className="cat-fill" style={{ width: `${(r.v / max) * 100}%`, background: color(r.k) }} /></div>
          <span className="bd-pc num">{pc(r.w, 0)}</span>
          <span className="bd-val num private">{eur(r.v)}</span>
        </div>
      ))}
    </>
  )
}

// ─── Modal : cours des supports ──────────────────────────────────────────────

function QuoteModal({ ctx, state, onClose, onApply }: {
  ctx: FinanceContext; state: QuoteState; onClose: () => void; onApply: (q: QuoteState) => void
}) {
  const [q, setQ] = useState<QuoteState>(state)
  const tickers = quoteTickers(ctx.holdings)
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(tickers.map((tk) => [tk, String(state.manual[tk] ?? ctx.holdings.find((h) => h.tk === tk)?.price ?? "")])))

  const priceOf = (tk: string) => (q.mode === "manual" && q.manual[tk] != null ? q.manual[tk] : q.mode === "api" && q.live?.[tk] ? q.live[tk].price : ctx.holdings.find((h) => h.tk === tk)?.price ?? 0)
  const srcOf = (tk: string) => (q.mode === "manual" && q.manual[tk] != null ? "manuel" : q.mode === "api" && q.live?.[tk] ? "api" : "enregistré")

  async function refresh() {
    setQ((p) => ({ ...p, status: "Requête en cours…" }))
    const next = await refreshLive({ ...q }, tickers)
    setQ(next)
  }

  function apply() {
    const next = { ...q }
    if (q.mode === "manual") {
      const manual: Record<string, number> = {}
      tickers.forEach((tk) => { const v = num(inputs[tk] ?? ""); if (v > 0) manual[tk] = v })
      next.manual = manual
      next.ts = `saisie du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    }
    onApply(next)
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>Cours des supports</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Source des cours</label>
            <div className="type-toggle">
              {([["demo", "ti-flask", "Enregistrés"], ["manual", "ti-pencil", "Saisie manuelle"], ["api", "ti-cloud-data-connection", "Fournisseur"]] as [QuoteMode, string, string][]).map(([m, ic, label]) => (
                <button key={m} className={`type-opt ${q.mode === m ? "active" : ""}`} onClick={() => setQ((p) => ({ ...p, mode: m }))}><i className={`ti ${ic}`} /> {label}</button>
              ))}
            </div>
            <div className="field-hint">
              En mode fournisseur, l&apos;app appelle <code>GET {"{endpoint}"}?symbols=A,B</code> depuis votre navigateur et attend <code>{`{ "A": { "price": 1.23, "prev": 1.20 } }`}</code>.
            </div>
          </div>
          {q.mode === "api" && (
            <div className="field-row">
              <div className="field"><label>Endpoint</label><input type="text" placeholder="https://api.exemple.com/quotes" value={q.api.endpoint} onChange={(e) => setQ((p) => ({ ...p, api: { ...p.api, endpoint: e.target.value } }))} /></div>
              <div className="field"><label>Clé d&apos;API</label><input type="text" placeholder="Bearer token" value={q.api.key} onChange={(e) => setQ((p) => ({ ...p, api: { ...p.api, key: e.target.value } }))} /></div>
            </div>
          )}
          <div className="q-status">
            {q.status ? <><i className="ti ti-info-circle" /> {q.status}</> : <><i className="ti ti-clock" /> Dernière mise à jour : {q.ts || "cours enregistrés"}</>}
          </div>
          <div className="q-list">
            {tickers.map((tk) => {
              const h = ctx.holdings.find((x) => x.tk === tk)!
              return (
                <div className="q-row" key={tk}>
                  <span className="q-tk num">{tk}</span>
                  <span className="q-name">{h.name}</span>
                  <span className="q-src">{srcOf(tk)}</span>
                  {q.mode === "manual"
                    ? <input className="q-input num" type="text" inputMode="decimal" value={inputs[tk] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [tk]: e.target.value }))} />
                    : <input className="q-input num" type="text" value={priceOf(tk)} disabled readOnly />}
                  <span className="q-cur">{h.cur === "USD" ? "$" : "€"}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ marginRight: "auto" }} onClick={() => onApply({ ...q, mode: "demo", manual: {}, live: null, ts: "", status: "" })}>Revenir aux cours enregistrés</button>
          <button className="btn btn-ghost" onClick={refresh}><i className="ti ti-refresh" /> Rafraîchir via le fournisseur</button>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={apply}><i className="ti ti-check" /> Appliquer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal : ligne de portefeuille ───────────────────────────────────────────

function FlowModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ ym: new Date().toISOString().slice(0, 7), amount: "", match: "", note: "" })
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!f.ym || !num(f.amount)) { setErr("Mois et montant requis."); return }
    setBusy(true)
    const res = await fetch("/api/investment-flows", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ym: f.ym, amountCents: Math.round(num(f.amount) * 100), matchCents: Math.round(num(f.match) * 100), note: f.note }),
    })
    setBusy(false)
    if (res.ok) onDone(); else setErr("Erreur lors de l'enregistrement.")
  }
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head"><h3>Ajouter un versement</h3><button className="icon-btn" onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button></div>
        <div className="modal-body">
          <div className="field"><label>Mois</label><input type="month" value={f.ym} onChange={(e) => setF({ ...f, ym: e.target.value })} /></div>
          <div className="field-row">
            <div className="field"><label>Versements (€)</label><input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div className="field"><label>Abondement employeur (€)</label><input value={f.match} onChange={(e) => setF({ ...f, match: e.target.value })} /></div>
          </div>
          <div className="field"><label>Note</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Versement exceptionnel…" /></div>
          {err && <div className="err on">{err}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>Ajouter le versement</button>
        </div>
      </div>
    </div>
  )
}

function LineModal({ ctx, holding, onClose, onDone }: {
  ctx: FinanceContext; holding: CtxHolding | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = !!holding
  const [f, setF] = useState({
    acct: holding?.acct ?? ctx.invAccounts[0]?.id ?? "",
    name: holding?.name ?? "", tk: holding?.tk ?? "", cls: (holding?.cls ?? "actions") as AssetClass,
    zone: holding?.zone ?? "Monde", sector: holding?.sector ?? "", cur: holding?.cur ?? "EUR",
    qty: holding ? String(holding.qty) : "", pru: holding ? String(holding.pru) : "", price: holding ? String(holding.price) : "",
    ter: holding ? String(holding.ter) : "", cap: holding?.cap ?? "Grandes",
  })
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.name.trim() || !num(f.qty) || !num(f.price)) { setErr("Nom, quantité et cours actuel sont requis."); return }
    setBusy(true)
    const body = {
      name: f.name.trim(), ticker: (f.tk.trim() || f.name.trim().slice(0, 6)).toUpperCase(),
      kind: f.cls === "crypto" ? "crypto" : f.cls === "euro" ? "fonds" : "etf",
      quantity: num(f.qty), unitPriceCents: Math.round(num(f.price) * 100), purchasePriceCents: Math.round((num(f.pru) || num(f.price)) * 100),
      accountId: f.acct || null, assetClass: f.cls, zone: f.zone, sector: f.sector.trim() || "Diversifié", currency: f.cur, cap: f.cap, terPct: num(f.ter),
    }
    const res = await fetch(isEdit ? `/api/placements/${holding!.id}` : "/api/placements", {
      method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) { setErr("Erreur lors de l'enregistrement."); return }
    onDone()
  }

  async function remove() {
    if (!holding) return
    setBusy(true)
    const res = await fetch(`/api/placements/${holding.id}`, { method: "DELETE" })
    setBusy(false)
    if (!res.ok) { setErr("Erreur lors de la suppression."); return }
    onDone()
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier la ligne" : "Ajouter une ligne au portefeuille"}</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {err && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {err}</div>}
          <div className="field">
            <label>Enveloppe</label>
            <select value={f.acct} onChange={(e) => set("acct")(e.target.value)}>
              {ctx.invAccounts.length === 0 && <option value="">Aucune enveloppe — créez-en une d&apos;abord</option>}
              {ctx.invAccounts.map((a) => <option key={a.id} value={a.id}>{INV_KINDS[a.kind].short} · {a.name}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field"><label>Nom du support</label><input type="text" placeholder="ex. Amundi MSCI World" value={f.name} onChange={(e) => set("name")(e.target.value)} autoFocus /></div>
            <div className="field"><label>Code / ticker</label><input type="text" placeholder="CW8" value={f.tk} onChange={(e) => set("tk")(e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Classe d&apos;actifs</label>
              <select value={f.cls} onChange={(e) => set("cls")(e.target.value)}>{(Object.keys(ASSETS) as AssetClass[]).map((k) => <option key={k} value={k}>{ASSETS[k].label}</option>)}</select></div>
            <div className="field"><label>Zone</label>
              <select value={f.zone} onChange={(e) => set("zone")(e.target.value)}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Secteur</label><input type="text" placeholder="Diversifié" value={f.sector} onChange={(e) => set("sector")(e.target.value)} /></div>
            <div className="field"><label>Devise</label>
              <select value={f.cur} onChange={(e) => set("cur")(e.target.value)}><option>EUR</option><option>USD</option><option>CHF</option><option>GBP</option></select></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Quantité</label><input type="text" inputMode="decimal" placeholder="23" value={f.qty} onChange={(e) => set("qty")(e.target.value)} /></div>
            <div className="field"><label>Prix de revient (PRU)</label><input type="text" inputMode="decimal" placeholder="468" value={f.pru} onChange={(e) => set("pru")(e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Cours actuel</label><input type="text" inputMode="decimal" placeholder="612,40" value={f.price} onChange={(e) => set("price")(e.target.value)} /></div>
            <div className="field"><label>Frais du support (TER %)</label><input type="text" inputMode="decimal" placeholder="0,38" value={f.ter} onChange={(e) => set("ter")(e.target.value)} /></div>
          </div>
          <div className="field"><label>Capitalisation</label>
            <select value={f.cap} onChange={(e) => set("cap")(e.target.value)}><option>Grandes</option><option>Moyennes</option><option>Petites</option><option>—</option></select></div>
        </div>
        <div className="modal-foot">
          {isEdit && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={remove} disabled={busy}>Supprimer</button>}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || ctx.invAccounts.length === 0}><i className="ti ti-check" /> {isEdit ? "Enregistrer" : "Ajouter la ligne"}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal : enveloppe ───────────────────────────────────────────────────────

function EnvelopeModal({ ctx, account, onClose, onDone }: {
  ctx: FinanceContext; account: CtxInvAccount | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = !!account
  const [f, setF] = useState({
    kind: (account?.kind ?? "pea") as InvKind, name: account?.name ?? "", bank: account?.bank ?? "",
    since: String(account?.since ?? ctx.year), paid: account ? String(account.paid) : "", monthly: account ? String(account.monthly) : "",
    fees: account ? String(account.fees) : "", match: account ? String(account.match) : "",
  })
  const [owners, setOwners] = useState<string[]>(account?.ownerIds ?? [])
  const [benefs, setBenefs] = useState<string[]>(account?.benefIds ?? [])
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const toggle = (list: string[], id: string, fn: (l: string[]) => void) => fn(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  async function save() {
    if (!f.name.trim()) { setErr("Le nom est requis."); return }
    setBusy(true)
    const body = {
      kind: f.kind, name: f.name.trim(), bank: f.bank.trim(), ownerIds: owners, benefIds: f.kind === "av" ? benefs : [],
      sinceYear: Math.round(num(f.since)) || ctx.year, paidCents: Math.round(num(f.paid) * 100), monthlyCents: Math.round(num(f.monthly) * 100),
      feesPct: num(f.fees), matchPct: num(f.match),
    }
    const res = await fetch(isEdit ? `/api/investment-accounts/${account!.id}` : "/api/investment-accounts", {
      method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) { setErr("Erreur lors de l'enregistrement."); return }
    onDone()
  }

  async function remove() {
    if (!account) return
    setBusy(true)
    await fetch(`/api/investment-accounts/${account.id}`, { method: "DELETE" })
    setBusy(false)
    onDone()
  }

  const people = ctx.members.filter((m) => !m.isChild)
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier l'enveloppe" : "Ajouter une enveloppe"}</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {err && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {err}</div>}
          <div className="field-row">
            <div className="field"><label>Type</label>
              <select value={f.kind} onChange={(e) => set("kind")(e.target.value)}>{(Object.keys(INV_KINDS) as InvKind[]).map((k) => <option key={k} value={k}>{INV_KINDS[k].label}</option>)}</select></div>
            <div className="field"><label>Ouverte en</label><input type="text" inputMode="numeric" value={f.since} onChange={(e) => set("since")(e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Nom</label><input type="text" placeholder="PEA BoursoBank" value={f.name} onChange={(e) => set("name")(e.target.value)} autoFocus /></div>
            <div className="field"><label>Établissement</label><input type="text" placeholder="BoursoBank" value={f.bank} onChange={(e) => set("bank")(e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Total versé</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="19 600" value={f.paid} onChange={(e) => set("paid")(e.target.value)} /><span className="cur">€</span></div></div>
            <div className="field"><label>Versement mensuel</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="300" value={f.monthly} onChange={(e) => set("monthly")(e.target.value)} /><span className="cur">€</span></div></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Frais de gestion annuels (%)</label><input type="text" inputMode="decimal" placeholder="0,5" value={f.fees} onChange={(e) => set("fees")(e.target.value)} /></div>
            <div className="field"><label>Abondement employeur (%)</label><input type="text" inputMode="decimal" placeholder="0" value={f.match} onChange={(e) => set("match")(e.target.value)} /></div>
          </div>
          <div className="field">
            <label>Titulaire(s)</label>
            <div className="chips">
              {people.map((m) => <button type="button" key={m.id} className={`chip ${owners.includes(m.id) ? "active" : ""}`} onClick={() => toggle(owners, m.id, setOwners)}>{m.short}</button>)}
            </div>
          </div>
          {f.kind === "av" && (
            <div className="field">
              <label>Bénéficiaire(s) du contrat</label>
              <div className="chips">
                {ctx.members.map((m) => <button type="button" key={m.id} className={`chip ${benefs.includes(m.id) ? "active" : ""}`} onClick={() => toggle(benefs, m.id, setBenefs)}>{m.short}</button>)}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          {isEdit && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={remove} disabled={busy}>Supprimer</button>}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><i className="ti ti-check" /> {isEdit ? "Enregistrer" : "Ajouter l'enveloppe"}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PlacementsClient() {
  const { ctx, error, reload } = useFinanceContext()
  const [profile, setProfile] = useState<ProfileKey>("equilibre")
  const [quotes, setQuotes] = useState<QuoteState | null>(null)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [flowModal, setFlowModal] = useState(false)
  const [lineModal, setLineModal] = useState<{ open: boolean; item: CtxHolding | null }>({ open: false, item: null })
  const [envModal, setEnvModal] = useState<{ open: boolean; item: CtxInvAccount | null }>({ open: false, item: null })
  const themeTick = useThemeTick()
  const chartWrap = useRef<HTMLDivElement>(null)

  useEffect(() => { setProfile(loadProfile()); setQuotes(loadQuotes()) }, [])

  const changeProfile = (p: ProfileKey) => { setProfile(p); saveProfile(p) }
  const applyQuotes = (q: QuoteState) => { setQuotes(q); saveQuotes(q); setQuoteOpen(false) }
  const done = useCallback(() => { setLineModal({ open: false, item: null }); setEnvModal({ open: false, item: null }); void reload() }, [reload])

  const m = useMemo(() => {
    if (!ctx || !quotes) return null
    const S: PortfolioState = computePortfolio(ctx, profile, overrides(quotes))
    const T = computeTax(taxInputs(ctx), situationFor(ctx))
    return { S, T }
  }, [ctx, profile, quotes])

  if (!ctx || !quotes || !m) return <LoadingOrError title="Placements" sub="Enveloppes, lignes, diversification et fiscalité" error={error} />

  const { S, T } = m
  const accts = ctx.invAccounts
  const kindOf = (id: string | null) => INV_KINDS[accts.find((a) => a.id === id)?.kind ?? "cto"]
  const hist = ctx.history
  const first = hist[0]?.value ?? 0
  const perf = first > 0 ? (S.total / first - 1) * 100 : 0
  const benchLast = hist.length ? hist[hist.length - 1].bench : null
  const bench = benchLast != null ? benchLast - 100 : null
  const actions = S.cls.find((c) => c.k === "actions")?.w ?? 0
  const peaUsed = usedCeiling(accts, "pea")
  const peapmeUsed = usedCeiling(accts, "peapme")
  const alloc = allocationRows(S)
  const allocMax = Math.max(1, ...alloc.map((r) => Math.max(r.cur, r.tgt)))
  const advice = investAdvice(S, ctx)
  const taxRows = investTaxRows(S, ctx, T.tmi, T.plafondPer)
  const fees = feeRows(S, accts)
  const zones = group(S.pos, "zone")
  const envs = group(S.pos, (p) => kindOf(p.acct).label)
  const flowsPerMonth = S.monthly
  const income = ctx.members.reduce((s, x) => s + x.incomeMonthly, 0)
  const profileLabel = PROFILES[profile].label
  const t = S.target

  // graphe : valorisation vs indice (base 100 au premier mois)
  const labels = hist.map((h) => { const [y, mo] = h.ym.split("-").map(Number); return new Date(y, mo - 1).toLocaleDateString("fr-FR", { month: "short" }) })
  const vals = hist.map((h, i) => (i === hist.length - 1 ? S.total : h.value))
  const port = vals.map((v) => (first ? (v / first) * 100 : 100))
  const cs = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null
  const grid = cs?.getPropertyValue("--chart-grid").trim() || "rgba(255,255,255,.05)"
  const fg = cs?.getPropertyValue("--fg-secondary").trim() || "#999"
  void themeTick

  return (
    <div className="page-placements">
      <PageHeader title="Placements" sub="Enveloppes, lignes, diversification et fiscalité" />

      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          {(Object.keys(PROFILES) as ProfileKey[]).map((k) => (
            <button key={k} className={`chip ${k === profile ? "active" : ""}`} onClick={() => changeProfile(k)}>{PROFILES[k].label}</button>
          ))}
          <span className="budget-hint">Profil {profileLabel.toLowerCase()} — cible actions {t.actions} %</span>
          <Link className="card-link" href="/parametres">Modifier</Link>
        </div>
        <div style={{ flex: 1 }} />
        <button className="pill" onClick={() => setQuoteOpen(true)}>
          <i className={`ti ti-${quotes.mode === "api" ? "cloud-data-connection" : quotes.mode === "manual" ? "pencil" : "flask"}`} /> {srcLabel(quotes.mode)}{quotes.ts ? ` · ${quotes.ts}` : ""}
        </button>
        <button className="btn btn-ghost" onClick={() => setQuoteOpen(true)}><i className="ti ti-refresh" /> Cours</button>
      </div>

      <div className="metrics">
        <Kpi label="Valorisation" icon="ti-chart-area-line" color="#1D9E75" value={eur(S.total)}
          sub={`${pcS(S.total ? (S.dayEur / S.total) * 100 : 0, 2)} aujourd'hui · ${eurS(S.dayEur)}`} tone={S.dayEur >= 0 ? "up" : "down"} />
        <Kpi label="Plus-value latente" icon="ti-trending-up" color="#378ADD" value={eurS(S.pv)}
          sub={`${pcS(S.paid ? (S.pv / S.paid) * 100 : 0)} sur ${eur(S.paid)} versés`} tone={S.pv >= 0 ? "up" : "down"} />
        <Kpi label="Performance 6 mois" icon="ti-flag" color="#7C6BD6" value={hist.length > 1 ? pcS(perf) : "—"}
          sub={bench != null ? `MSCI World (EUR) ${pcS(bench)} · écart ${pcS(perf - bench)}` : "Historique en cours de constitution"} tone={bench != null && perf < bench ? "down" : "up"} />
        <Kpi label="Versements programmés" icon="ti-calendar-repeat" color="#EF9F27" value={eur(S.monthly)} sub={`+ ${eur(S.match)} d'abondement employeur`} />
      </div>
      <div className="metrics">
        <Kpi label="TRI annualisé estimé" icon="ti-percentage" color="#1D9E75" value={pc(S.tri)} sub={`sur ${S.years.toFixed(1)} ans de détention moyenne`} tone={S.tri >= 0 ? "up" : "down"} />
        <Kpi label="Frais moyens pondérés" icon="ti-receipt-tax" color="#D85A30" value={pc(S.ter, 2)} sub={`≈ ${eur(S.fees)} / an, gestion incluse`} tone={S.ter > 0.6 ? "down" : "up"} />
        <Kpi label="Part actions" icon="ti-chart-candle" color="#378ADD" value={pc(actions)}
          sub={`Cible ${profileLabel.toLowerCase()} ${t.actions} % · écart ${pcS(actions - t.actions, 0)}`} tone={Math.abs(actions - t.actions) < 5 ? "up" : "down"} />
        <Kpi label="Plafond PEA restant" icon="ti-lock-open" color="#D4537E" value={eur(150000 - peaUsed)}
          sub={`${eur(peaUsed)} versés sur 150 000 € · PEA-PME ${eur(225000 - peaUsed - peapmeUsed)}`} />
      </div>

      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Portefeuille vs indice de référence</span>
            <span className="card-sub num">{hist.length > 1 ? `Base 100 il y a ${hist.length - 1} mois · ${eur(first)} → ${eur(S.total)}` : "—"}</span>
          </div>
          <div className="chart-box" style={{ height: 250 }} ref={chartWrap}>
            {hist.length > 1 ? (
              <Line
                data={{
                  labels,
                  datasets: [
                    { label: "Portefeuille", data: port, borderColor: "#1D9E75", borderWidth: 2, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, fill: false },
                    ...(hist.some((h) => h.bench != null)
                      ? [{ label: "MSCI World (EUR)", data: hist.map((h) => h.bench), borderColor: "#888780", borderWidth: 1.5, borderDash: [5, 4], tension: 0.35, pointRadius: 0, pointHoverRadius: 5, fill: false }]
                      : []),
                  ],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false, animation: false,
                  interaction: { intersect: false, mode: "index" },
                  plugins: {
                    legend: { display: true, position: "top", align: "end", labels: { color: fg, boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: "circle", padding: 14 } },
                    tooltip: { callbacks: { label: (c) => `${c.dataset.label} : ${(c.parsed.y ?? 0).toFixed(1)} (base 100)` } },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: fg } },
                    y: { grid: { color: grid }, border: { display: false }, ticks: { color: fg } },
                  },
                }}
              />
            ) : <div className="empty">L&apos;historique se construit mois après mois.</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Allocation vs cible</span></div>
          <div>
            {alloc.map((r) => {
              const a = ASSETS[r.k]
              const off = Math.abs(r.gap) >= 5
              return (
                <div className="alloc-row" key={r.k}>
                  <span className="alloc-name"><span className="legend-dot" style={{ background: a.color }} />{a.label}</span>
                  <div className="cat-track">
                    <div className="cat-fill" style={{ width: `${(r.cur / allocMax) * 100}%`, background: a.color }} />
                    <span className="cat-cap" style={{ left: `${(r.tgt / allocMax) * 100}%` }} title={`Cible ${r.tgt} %`} />
                  </div>
                  <span className="alloc-cur num">{pc(r.cur, 0)}</span>
                  <span className="alloc-tgt num">/ {r.tgt} %</span>
                  <span className={`alloc-gap num ${off ? "off" : ""}`}>{Math.abs(r.gap) < 0.5 ? "à la cible" : (r.gap > 0 ? "− " : "+ ") + eur(Math.abs(r.money))}</span>
                </div>
              )
            })}
            <div className="inv-note"><span className="cat-cap-demo" /> repère = allocation cible du profil {profileLabel.toLowerCase()} · dernière colonne = mouvement à faire pour revenir à la cible</div>
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Conseils &amp; rééquilibrage</span><span className="card-sub">Règles appliquées au profil sélectionné</span></div>
        <div>
          {advice.length === 0 && <div className="empty" style={{ padding: 20 }}>Ajoutez des lignes pour obtenir des conseils de diversification.</div>}
          {advice.map((a, i) => <AdviceRow key={i} a={a} />)}
        </div>
        <Disclaimer />
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Enveloppes</span>
          <span className="card-sub">Fiscalité, plafonds et versements par contrat</span>
          <span className="card-link" role="button" onClick={() => setEnvModal({ open: true, item: null })}>Ajouter une enveloppe</span>
        </div>
        <div className="inv-grid">
          {accts.length === 0 && <div className="empty">Aucune enveloppe. Créez un PEA, une assurance vie… pour y ranger vos lignes.</div>}
          {accts.map((a) => {
            const k = INV_KINDS[a.kind]
            const val = byAcct(S.pos, a.id)
            const pv = S.pos.filter((p) => p.acct === a.id).reduce((s, p) => s + p.pv, 0)
            const ceil = k.ceiling ? k.ceiling - (a.kind === "pea" ? peaUsed : peapmeUsed) : null
            const age = ctx.year - a.since
            return (
              <div className="inv-card" key={a.id} style={{ cursor: "pointer" }} onClick={() => setEnvModal({ open: true, item: a })}>
                <div className="inv-head">
                  <span className="inv-badge" style={{ background: `${k.color}1f`, color: k.color }}><i className={`ti ${k.icon}`} /> {k.short}</span>
                  <div className="inv-title"><div className="inv-name">{a.name}</div><div className="inv-bank">{a.bank} · ouvert en {a.since} ({age} ans)</div></div>
                  <span className="inv-owners">{a.ownerIds.map((o) => <MiniAv key={o} m={ctx.members.find((x) => x.id === o)} size={26} />)}</span>
                </div>
                <div className="inv-nums">
                  <div><div className="inv-lbl">Valorisation</div><div className="inv-val num private">{eur(val)}</div></div>
                  <div><div className="inv-lbl">Versé</div><div className="inv-val num private">{eur(a.paid)}</div></div>
                  <div><div className="inv-lbl">± value</div><div className={`inv-val num private ${pv >= 0 ? "pos" : "neg"}`}>{eurS(pv)} <span className="inv-sub num">{pcS(a.paid ? (pv / a.paid) * 100 : 0, 0)}</span></div></div>
                  <div><div className="inv-lbl">Versement / mois</div><div className="inv-val num private">{a.monthly ? eur(a.monthly) : "—"}{a.match ? <> <span className="inv-sub">+{a.match} %</span></> : null}</div></div>
                  <div><div className="inv-lbl">Frais de gestion</div><div className="inv-val num">{a.fees ? pc(a.fees, 2) : "aucun"}</div></div>
                  <div><div className="inv-lbl">{ceil != null ? "Plafond restant" : "Poids"}</div><div className="inv-val num private">{ceil != null ? eur(ceil) : pc(S.total ? (val / S.total) * 100 : 0, 0)}</div></div>
                </div>
                <div className="inv-fisc">
                  <i className="ti ti-scale" /> {k.fisc}
                  {a.kind === "pea" && age >= 5 ? <> · <b className="pos">exonération d&apos;IR acquise</b></> : a.kind === "pea" ? ` · exonération dans ${5 - age} an${5 - age > 1 ? "s" : ""}` : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Lignes du portefeuille</span>
          <span className="card-link" role="button" onClick={() => setLineModal({ open: true, item: null })}>Ajouter une ligne</span>
        </div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Ligne</th><th>Enveloppe</th><th>Classe</th><th>Zone</th><th className="r">Qté</th><th className="r">PRU</th><th className="r">Cours</th><th className="r">Jour</th><th className="r">Valeur</th><th className="r">Poids</th><th className="r">± value</th><th className="r">TER</th></tr></thead>
            <tbody>
              {S.pos.length === 0 && <tr><td colSpan={12}>Aucune ligne. Ajoutez votre première position.</td></tr>}
              {S.pos.map((p) => {
                const k = kindOf(p.acct), a = ASSETS[p.cls] ?? ASSETS.actions
                const flat = p.cls === "euro" || p.cls === "monetaire"
                const sym = p.cur === "USD" ? "$" : "€"
                const src = ctx.holdings.find((h) => h.id === p.id) ?? null
                return (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setLineModal({ open: true, item: src })}>
                    <td>{p.name}<span className="line-tk num">{p.tk}</span></td>
                    <td><span className="inv-badge sm" style={{ background: `${k.color}1f`, color: k.color }}>{k.short}</span></td>
                    <td><span className="legend-dot" style={{ background: a.color, display: "inline-block" }} /> {a.label}</td>
                    <td>{p.zone}</td>
                    <td className="r num">{flat ? "—" : p.qty.toLocaleString("fr-FR")}</td>
                    <td className="r num private">{flat ? "—" : `${num2(p.pru)} ${sym}`}</td>
                    <td className="r num private">{flat ? "—" : num2(p.price)}</td>
                    <td className={`r num ${p.day >= 0 ? "pos" : "neg"}`}>{p.day ? pcS(p.day * 100, 2) : "—"}</td>
                    <td className="r num private">{eur(p.value)}</td>
                    <td className="r num">{pc(p.w, 1)}</td>
                    <td className={`r num private ${p.pv >= 0 ? "pos" : "neg"}`}>{eurS(p.pv)}</td>
                    <td className="r num">{p.ter ? pc(p.ter, 2) : "—"}</td>
                  </tr>
                )
              })}
              {S.pos.length > 0 && (
                <tr className="tot">
                  <td>{S.pos.length} lignes</td><td colSpan={7} />
                  <td className="r num private">{eur(S.total)}</td><td className="r num">100 %</td>
                  <td className={`r num private ${S.pv >= 0 ? "pos" : "neg"}`}>{eurS(S.pv)}</td>
                  <td className="r num">{pc(S.ter, 2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card"><div className="card-header"><span className="card-title">Zone géographique</span></div><Bars rows={zones} color={hash} /></div>
        <div className="card"><div className="card-header"><span className="card-title">Secteurs</span></div><Bars rows={group(S.pos, "sector")} color={hash} /></div>
      </div>
      <div className="grid-2 mb-16">
        <div className="card"><div className="card-header"><span className="card-title">Devises</span></div><Bars rows={group(S.pos, "cur")} color={(k) => (k === "EUR" ? "#1D9E75" : "#EF9F27")} /></div>
        <div className="card"><div className="card-header"><span className="card-title">Capitalisation</span></div><Bars rows={group(S.pos, "cap")} color={hash} /></div>
      </div>
      <div className="grid-2 mb-16">
        <div className="card"><div className="card-header"><span className="card-title">Poids des enveloppes</span></div>
          <Bars rows={envs} color={(k) => Object.values(INV_KINDS).find((x) => x.label === k)?.color ?? "#888780"} /></div>
        <div className="card">
          <div className="card-header"><span className="card-title">Frais annuels par ligne</span></div>
          <Bars rows={fees.rows} color={hash} />
          <div className="inv-note">Total estimé {eur(S.fees)} par an ({pc(S.ter, 2)} de frais de supports + frais de gestion des enveloppes) — dont {eur(fees.top)} sur ces {fees.rows.length} lignes.</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Simulation fiscale</span></div>
          <div className="stat-list">{taxRows.map((r) => <StatRow key={r.label} label={r.label} value={r.value} hint={r.hint} />)}</div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Versements du foyer</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlowModal(true)}><i className="ti ti-plus" /> Ajouter</button>
          </div>
          <div className="table-wrap">
            <table className="dtable">
              <thead><tr><th>Mois</th><th className="r">Versements</th><th className="r">Abondement</th><th className="r">Total</th><th>Note</th><th /></tr></thead>
              <tbody>
                {ctx.flows.map((f) => {
                  const [y, mo] = f.ym.split("-").map(Number)
                  return (
                    <tr key={f.id}>
                      <td>{new Date(y, mo - 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}</td>
                      <td className="r num private">{eur(f.amount)}</td>
                      <td className="r num private">{eur(f.match)}</td>
                      <td className="r num private">{eur(f.amount + f.match)}</td>
                      <td className="flow-note">{f.note}</td>
                      <td className="r"><button type="button" className="icon-btn" title="Supprimer" onClick={async () => { await fetch(`/api/investment-flows/${f.id}`, { method: "DELETE" }); reload() }}><i className="ti ti-trash" /></button></td>
                    </tr>
                  )
                })}
                {!ctx.flows.length && <tr><td colSpan={6} className="flow-note">Aucun versement enregistré.</td></tr>}
                <tr className="tot">
                  <td>{ctx.flows.length} mois</td>
                  <td className="r num private">{eur(ctx.flows.reduce((x, f) => x + f.amount, 0))}</td>
                  <td className="r num private">{eur(ctx.flows.reduce((x, f) => x + f.match, 0))}</td>
                  <td className="r num private">{eur(ctx.flows.reduce((x, f) => x + f.amount + f.match, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="inv-note">
            Rythme actuel : {eur(flowsPerMonth)} par mois, soit {eur(flowsPerMonth * 12)} par an — {pc(income ? (flowsPerMonth / income) * 100 : 0, 0)} des revenus du foyer.
          </div>
        </div>
      </div>

      {flowModal && <FlowModal onClose={() => setFlowModal(false)} onDone={() => { setFlowModal(false); reload() }} />}
      {quoteOpen && <QuoteModal ctx={ctx} state={quotes} onClose={() => setQuoteOpen(false)} onApply={applyQuotes} />}
      {lineModal.open && <LineModal ctx={ctx} holding={lineModal.item} onClose={() => setLineModal({ open: false, item: null })} onDone={done} />}
      {envModal.open && <EnvelopeModal ctx={ctx} account={envModal.item} onClose={() => setEnvModal({ open: false, item: null })} onDone={done} />}
    </div>
  )
}
