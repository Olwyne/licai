"use client"
import { useState } from "react"
import { CURRENCIES, getBaseCurrency, baseSym, rebase, DEFAULT_FX, type FxSource, type FxTable } from "@/lib/finance/fx"

export const FX_DEMO_TS = "taux de référence (démonstration)"
const API_KEY = "licai-fx-api"

const readApi = (): { endpoint: string; key: string } => {
  try { const v = localStorage.getItem(API_KEY); if (v) return JSON.parse(v) } catch { /* indisponible */ }
  return { endpoint: "", key: "" }
}

export function FxModal({ rates, source, ts, auto: autoInit, onClose, onSaved }: {
  rates: FxTable; source: FxSource; ts: string; auto: boolean; onClose: () => void; onSaved: () => void
}) {
  const base = getBaseCurrency()
  const demoFx = rebase(DEFAULT_FX, base)
  const [src, setSrc] = useState<FxSource>(source)
  const [table, setTable] = useState<FxTable>(rates)
  const [inputs, setInputs] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, String(v)])))
  const [api, setApi] = useState(readApi)
  const [stamp, setStamp] = useState(ts || FX_DEMO_TS)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState(autoInit)

  const persistApi = () => { try { localStorage.setItem(API_KEY, JSON.stringify(api)) } catch { /* indisponible */ } }

  async function refresh() {
    persistApi()
    setStatus("Requête en cours…")
    try {
      if (!api.endpoint) {
        // Sans fournisseur personnalisé : taux du jour via le serveur (devises : BCE · crypto : CoinGecko).
        const res = await fetch("/api/market/fx")
        if (!res.ok) throw new Error("HTTP " + res.status)
        const { data } = (await res.json()) as { data: { rates: FxTable; failed: string[]; ts: string } }
        setTable(data.rates); setInputs(Object.fromEntries(Object.entries(data.rates).map(([k, v]) => [k, String(v)])))
        setSrc("api"); setStamp(data.ts)
        setStatus(data.failed.length ? `Taux reçus (indisponibles : ${data.failed.join(", ")} — valeurs précédentes conservées)` : "Taux du jour reçus (devises et crypto)")
        return
      }
      const list = Object.keys(CURRENCIES).filter((c) => c !== base)
      const url = api.endpoint + (api.endpoint.includes("?") ? "&" : "?") + "base=" + base + "&symbols=" + list.join(",")
      const res = await fetch(url, api.key ? { headers: { Authorization: "Bearer " + api.key } } : undefined)
      if (!res.ok) throw new Error("HTTP " + res.status)
      const j = (await res.json()) as { rates?: Record<string, number> } & Record<string, number>
      const r = (j.rates ?? j) as Record<string, number>
      const next: FxTable = { ...table }
      list.forEach((c) => { if (Number(r[c]) > 0) next[c] = 1 / Number(r[c]) })
      setTable(next); setInputs(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])))
      setSrc("api")
      setStamp(new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))
      setStatus("Taux reçus du fournisseur")
    } catch (e) {
      setStatus(`Échec de la requête (${(e as Error).message}) — taux précédents conservés`)
    }
  }

  async function save() {
    setBusy(true)
    let rows = table
    let ts2 = stamp
    if (src === "manual") {
      rows = { ...table }
      Object.entries(inputs).forEach(([k, v]) => { const n = parseFloat(v.replace(",", ".")); if (n > 0 && k in CURRENCIES && k !== base) rows[k] = n })
      ts2 = "taux saisis manuellement"
    }
    if (src === "demo") { rows = { ...demoFx }; ts2 = FX_DEMO_TS }
    persistApi()
    const res = await fetch("/api/fx", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rates: rows, source: src, ts: ts2, auto }) })
    setBusy(false)
    if (!res.ok) { setStatus("Erreur lors de l'enregistrement."); return }
    onSaved()
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>Taux de change</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Source des taux</label>
            <div className="type-toggle">
              {([["demo", "ti-flask", "Référence"], ["manual", "ti-pencil", "Saisie manuelle"], ["api", "ti-cloud-data-connection", "Fournisseur"]] as [FxSource, string, string][]).map(([m, ic, l]) => (
                <button key={m} type="button" className={`type-opt ${src === m ? "active" : ""}`} onClick={() => setSrc(m)}><i aria-hidden="true" className={`ti ${ic}`} /> {l}</button>
              ))}
            </div>
            <div className="field-hint">
              Sans endpoint, « Rafraîchir » récupère automatiquement les taux du jour (devises : BCE · crypto : CoinGecko).<br />
              Avec un fournisseur personnalisé : <code>GET {"{endpoint}"}?base={base}&amp;symbols=USD,CHF</code> renvoyant <code>{`{ "rates": { "USD": 1.134 } }`}</code>. L&apos;app inverse le taux pour obtenir la contre-valeur dans la devise de référence.
            </div>
          </div>
          {src === "api" && (
            <div className="field-row">
              <div className="field"><label>Endpoint</label><input type="text" placeholder="https://api.exemple.com/latest" value={api.endpoint} onChange={(e) => setApi({ ...api, endpoint: e.target.value })} /></div>
              <div className="field"><label>Clé d&apos;API</label><input type="text" placeholder="Bearer token" value={api.key} onChange={(e) => setApi({ ...api, key: e.target.value })} /></div>
            </div>
          )}
          <label className="set-row" style={{ cursor: "pointer", marginBottom: 8 }}>
            <div className="flex-1">
              <div className="set-name">Mise à jour automatique</div>
              <div className="set-desc">Taux de change et cryptos rafraîchis toutes les 6 h (devises : BCE · crypto : CoinGecko). Chaque relevé alimente l&apos;historique des taux.</div>
            </div>
            <input type="checkbox" role="switch" aria-label="Mise à jour automatique des taux" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          </label>
          <div className="q-status">{status ? <><i aria-hidden="true" className="ti ti-info-circle" /> {status}</> : <><i aria-hidden="true" className="ti ti-clock" /> Dernière mise à jour : {stamp}</>}</div>
          <div className="q-list">
            {Object.entries(CURRENCIES).map(([k, c]) => (
              <div className="q-row" key={k}>
                <span className="q-tk num">{k}</span><span className="q-name">{c.name}</span>
                <span className="q-src">1 {k} =</span>
                <input className="q-input num" type="text" inputMode="decimal" value={src === "demo" ? String(demoFx[k]) : inputs[k] ?? ""}
                  disabled={k === base || src !== "manual"} onChange={(e) => setInputs((p) => ({ ...p, [k]: e.target.value }))} />
                <span className="q-cur">{baseSym()}</span>
              </div>
            ))}
          </div>
          <div className="field-hint">La devise de référence du foyer est le {base} : tous les totaux, budgets et impôts sont exprimés dans cette devise.</div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={refresh}><i aria-hidden="true" className="ti ti-refresh" /> Rafraîchir via le fournisseur</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><i aria-hidden="true" className="ti ti-check" /> Appliquer</button>
        </div>
      </div>
    </div>
  )
}
