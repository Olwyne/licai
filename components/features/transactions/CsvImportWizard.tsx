"use client"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { MiniAv } from "@/components/features/finance/ui"
import { formatCents } from "@/lib/money"
import { useFetch } from "@/lib/use-fetch"
import {
  applyTemplate, decodeCsv, DATE_FORMATS, DEFAULT_TEMPLATE, detectSeparator, detectSkipLines, guessDateFormat, guessMapping, matchTemplate,
  parseAmount, parseDate, parsePasted, tokenizeCsv, type CsvTemplate, type ImportIssue,
} from "@/lib/finance/csv-import"
import type { Account, Bank, Category, Member, Transaction } from "@/db/schema"

interface Props {
  accounts: Account[]
  banks: Bank[]
  categories: Category[]
  txList: Transaction[]
  members: Member[]
  onImported: (txs: Transaction[]) => void
  onClose: () => void
}

type SavedTemplate = CsvTemplate & { id: string }
type Source = "csv" | "manual"

interface Row {
  key: number
  date: string // AAAA-MM-JJ
  name: string
  amountText: string
  categoryId: string
  checked: boolean
}

const DATE_LABELS: Record<string, string> = {
  "DD/MM/YYYY": "JJ/MM/AAAA", "DD/MM/YY": "JJ/MM/AA", "MM/DD/YYYY": "MM/JJ/AAAA", "YYYY-MM-DD": "AAAA-MM-JJ", "YYYY/MM/DD": "AAAA/MM/JJ", "DD-MM-YYYY": "JJ-MM-AAAA", "DD.MM.YYYY": "JJ.MM.AAAA",
}
const SEP_LABELS: Record<string, string> = { ";": "Point-virgule ;", ",": "Virgule ,", "\t": "Tabulation", "|": "Barre verticale |" }

const SAMPLE_CSV = `Date;Libellé;Débit;Crédit
01/08/2026;Courses Monoprix;87,40;
02/08/2026;Netflix;13,99;
15/08/2026;Salaire;;2800,00
20/08/2026;EDF;120,00;`

const centsText = (c: number) => (c / 100).toFixed(2).replace(".", ",")
const today = () => new Date().toISOString().slice(0, 10)

export function CsvImportWizard({ accounts, banks, categories, txList, members, onImported, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef(0)
  const nextKey = () => ++keyRef.current

  const { data: saved, reload: reloadTemplates } = useFetch<SavedTemplate[]>("/api/csv-templates")
  const templates = saved ?? []

  const [source, setSource] = useState<Source>("csv")
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rawCsv, setRawCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [bankId, setBankId] = useState(banks[0]?.id ?? "")
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [owners, setOwners] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [pasted, setPasted] = useState("")

  const [t, setT] = useState<CsvTemplate>(DEFAULT_TEMPLATE)
  const [matchedName, setMatchedName] = useState("")
  const [templateSel, setTemplateSel] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [templateMsg, setTemplateMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [rows, setRows] = useState<Row[]>([])
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")

  // Anciens formats enregistrés dans le navigateur : repris une fois dans les modèles du foyer, puis oubliés localement.
  useEffect(() => {
    let legacy: Partial<CsvTemplate & { amountMode: string }>[] = []
    try { legacy = JSON.parse(localStorage.getItem("licai-csv-presets") ?? "[]") } catch { /* rien à reprendre */ }
    if (!Array.isArray(legacy) || legacy.length === 0) return
    Promise.all(legacy.map((p) => fetch("/api/csv-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: p }) })))
      .then(() => { try { localStorage.removeItem("licai-csv-presets") } catch { /* ignoré */ } reloadTemplates() })
      .catch(() => {})
  }, [reloadTemplates])

  const tokens = useMemo(() => (rawCsv ? tokenizeCsv(rawCsv, t.separator) : []), [rawCsv, t.separator])
  const headers = tokens[t.skipLines] ?? []
  const parsed = useMemo(() => (tokens.length ? applyTemplate(tokens, t) : { headers: [], rows: [], issues: [] }), [tokens, t])
  const patch = (p: Partial<CsvTemplate>) => setT((x) => ({ ...x, ...p }))

  // ── Étape 1 ──

  function readFile(file: File) {
    file.arrayBuffer().then((buf) => { setRawCsv(decodeCsv(buf)); setFileName(file.name) }).catch(() => {})
  }

  function goToStep2() {
    const sep = detectSeparator(rawCsv)
    const toks = tokenizeCsv(rawCsv, sep)
    const skip = detectSkipLines(toks)
    const hdrs = toks[skip] ?? []
    const g = guessMapping(hdrs)
    const col = (name: string) => hdrs.findIndex((h) => h === name)
    const dateSamples = toks.slice(skip + 1, skip + 31).map((r) => r[col(g.dateCol)] ?? "")
    const amountSamples = toks.slice(skip + 1, skip + 31).flatMap((r) => [r[col(g.amountCol)], r[col(g.debitCol)], r[col(g.creditCol)]]).filter(Boolean) as string[]
    const dotDecimal = amountSamples.some((a) => /\d\.\d{1,2}$/.test(a.trim())) && !amountSamples.some((a) => /\d,\d{1,2}$/.test(a.trim()))
    let next: CsvTemplate = { ...DEFAULT_TEMPLATE, separator: sep, skipLines: skip, dateFormat: guessDateFormat(dateSamples), decimal: dotDecimal ? "." : ",", ...g }
    const match = matchTemplate(templates, hdrs, bankId || null)
    if (match) { next = { ...match, separator: sep, skipLines: skip }; setMatchedName(match.name); setTemplateSel(match.name) } else { setMatchedName(""); setTemplateSel("") }
    setT(next)
    setTemplateMsg(null)
    setStep(2)
  }

  function goToManual() {
    const base: Row[] = pasted.trim() ? parsePasted(pasted).rows.map((r) => ({ key: nextKey(), date: r.date, name: r.name, amountText: centsText(r.amountCents), categoryId: categories.find((c) => c.label.toLowerCase() === r.category.toLowerCase())?.id ?? "", checked: true })) : []
    setIssues(pasted.trim() ? parsePasted(pasted).issues : [])
    setRows(base.length ? base : [blankRow()])
    setStep(3)
  }

  const blankRow = (): Row => ({ key: nextKey(), date: today(), name: "", amountText: "", categoryId: "", checked: true })

  // ── Étape 2 : modèles ──

  async function saveTemplate(name: string) {
    const n = name.trim() || t.name || "Mon format"
    const res = await fetch("/api/csv-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: { ...t, name: n, bankId: bankId || null } }) })
    if (!res.ok) { setTemplateMsg({ text: ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Impossible d'enregistrer ce format.", ok: false }); return }
    setTemplateMsg({ text: `Format « ${n} » enregistré pour ${bankId ? banks.find((b) => b.id === bankId)?.name ?? "cette banque" : "toutes les banques"}.`, ok: true })
    setTemplateName(""); setTemplateSel(n); setMatchedName(n)
    reloadTemplates()
  }

  function applySaved(tpl: SavedTemplate) {
    setT({ ...tpl, separator: tpl.separator })
    setTemplateMsg({ text: `Format « ${tpl.name} » appliqué.`, ok: true })
  }

  async function deleteSaved() {
    const tpl = templates.find((x) => x.name === templateSel)
    if (!tpl) return
    await fetch(`/api/csv-templates/${tpl.id}`, { method: "DELETE" })
    setTemplateMsg({ text: `Format « ${tpl.name} » supprimé.`, ok: false }); setTemplateSel(""); setMatchedName("")
    reloadTemplates()
  }

  function goToStep3() {
    setRows(parsed.rows.map((r) => ({ key: nextKey(), date: r.date, name: r.name, amountText: centsText(r.amountCents), categoryId: "", checked: !isDup(r.date, r.amountCents) })))
    setIssues(parsed.issues)
    setStep(3)
  }

  // ── Étape 3 ──

  const isDup = (date: string, cents: number) => txList.some((x) => x.date === date && Math.abs(x.amountCents - Math.abs(cents)) < 1)
  const view = rows.map((r) => {
    const cents = parseAmount(r.amountText, ",")
    const dateOk = parseDate(r.date.split("-").reverse().join("/"), "DD/MM/YYYY") !== null
    const errors = [!dateOk && "date", !r.name.trim() && "libellé", cents === null && "montant"].filter(Boolean) as string[]
    return { ...r, cents, errors, dup: cents !== null && dateOk && isDup(r.date, cents) }
  })
  const importable = view.filter((r) => r.checked && r.errors.length === 0)
  const netCents = importable.reduce((s, r) => s + (r.cents ?? 0), 0)
  const dups = view.filter((r) => r.dup).length
  const setRow = (key: number, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)))

  async function handleImport() {
    if (importable.length === 0) return
    if (!accountId) { setImportError("Veuillez sélectionner un compte."); return }
    setImporting(true); setImportError("")
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, rows: importable.map((r) => ({ name: r.name.trim(), amountCents: r.cents, date: r.date, categoryId: r.categoryId || undefined })), ownerIds: owners }),
      })
      if (!res.ok) { setImportError("Erreur lors de l'import."); return }
      const imported = ((await res.json()) as { data: { imported: number } }).data.imported
      const listRes = await fetch(`/api/transactions?accountId=${accountId}`)
      onImported(listRes.ok ? ((await listRes.json()) as { data: Transaction[] }).data.slice(0, imported) : [])
    } catch { setImportError("Erreur réseau.") } finally { setImporting(false) }
  }

  const filteredAccounts = bankId ? accounts.filter((a) => a.bankId === bankId) : accounts
  const acct = accounts.find((a) => a.id === accountId)
  const bank = banks.find((b) => b.id === acct?.bankId)
  const ownerNames = members.filter((m) => owners.includes(m.id)).map((m) => m.short || m.name)
  const toMini = (m: Member) => ({ id: m.id, name: m.name, short: m.short, role: m.role, color: m.colorHex, incomeMonthly: 0, birthYear: null, isChild: false })
  const step2Ready = (t.amountMode === "single" ? Boolean(t.amountCol) : Boolean(t.debitCol || t.creditCol)) && Boolean(t.dateCol && t.labelCol)
  const nextLabel = step === 3 ? (importing ? "Import…" : `Importer ${importable.length} opération${importable.length > 1 ? "s" : ""}`) : "Continuer"
  const nextDisabled = step === 1 ? !accountId || (source === "csv" && !rawCsv) : step === 2 ? !step2Ready || parsed.rows.length === 0 : importing || importable.length === 0
  const colOptions = (blank = false) => <>{blank && <option value="">—</option>}{headers.map((h) => <option key={h} value={h}>{h}</option>)}</>
  const next = () => (step === 1 ? (source === "manual" ? goToManual() : goToStep2()) : step === 2 ? goToStep3() : void handleImport())
  const back = () => setStep(step === 3 && source === "csv" ? 2 : 1)

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>{source === "manual" ? "Saisir des opérations" : "Importer un relevé CSV"}</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>

        <div className="steps">
          {([[1, source === "manual" ? "Compte & saisie" : "Fichier & compte"], [2, "Colonnes"], [3, "Vérification"]] as const).filter(([n]) => source === "csv" || n !== 2).map(([n, label]) => (
            <div key={n} className={`step${step === n ? " active" : step > n ? " done" : ""}`}>
              <span className="step-n">{step > n ? "✓" : source === "manual" && n === 3 ? 2 : n}</span> {label}
            </div>
          ))}
        </div>

        <div className="modal-body">
          {/* Étape 1 */}
          <div className={`import-step${step === 1 ? " active" : ""}`}>
            <div className="type-toggle" style={{ marginBottom: 14 }}>
              <button type="button" className={`type-opt${source === "csv" ? " active" : ""}`} onClick={() => setSource("csv")}><i aria-hidden="true" className="ti ti-file-import" /> Fichier CSV de la banque</button>
              <button type="button" className={`type-opt${source === "manual" ? " active" : ""}`} onClick={() => setSource("manual")}><i aria-hidden="true" className="ti ti-keyboard" /> Saisie manuelle</button>
            </div>

            {source === "csv" ? (
              <>
                <label className={`dropzone${isDragOver ? " over" : ""}${fileName ? " filled" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }} onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) readFile(f) }}>
                  <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
                  <i aria-hidden="true" className="ti ti-upload dz-ic" />
                  <div className="dz-title">Dépose ton fichier CSV ici</div>
                  <div className="dz-sub">ou clique pour parcourir · CSV exporté depuis ta banque (UTF-8 ou Windows-1252)</div>
                  <div className="dz-file">{fileName ? `✓ ${fileName}` : ""}</div>
                </label>
                <button type="button" className="link-btn" onClick={() => { setRawCsv(SAMPLE_CSV); setFileName("example.csv") }}><i aria-hidden="true" className="ti ti-flask" /> Utiliser un relevé d&apos;exemple</button>
              </>
            ) : (
              <div className="field">
                <label htmlFor="paste-area">Coller depuis un tableur <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(facultatif)</span></label>
                <textarea id="paste-area" rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)}
                  placeholder={"Une opération par ligne : date, libellé, montant, catégorie (facultative)\n15/08/2026\tCafé\t-3,50\tRestauration"} />
                <div className="field-hint">Copiez des cellules d&apos;Excel ou de Google Sheets. Sans collage, vous saisissez les lignes une à une à l&apos;étape suivante.</div>
              </div>
            )}

            <div className="field-row" style={{ marginTop: 18 }}>
              <div className="field"><label>Banque</label>
                <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
                  <option value="">Toutes</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select></div>
              <div className="field"><label>Compte de destination</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {filteredAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></div>
            </div>
            <div className="field">
              <label>Attribuer les opérations à</label>
              <div className="owner-picker">
                {members.filter((m) => !m.isChild).map((m) => (
                  <button key={m.id} type="button" className={`owner-opt${owners.includes(m.id) ? " on" : ""}`} onClick={() => setOwners((o) => (o.includes(m.id) ? o.filter((x) => x !== m.id) : [...o, m.id]))}>
                    <MiniAv m={toMini(m)} size={24} /> {m.short || m.name}
                  </button>
                ))}
              </div>
              <div className="field-hint">Plusieurs personnes = dépense partagée du foyer.</div>
            </div>
          </div>

          {/* Étape 2 : colonnes */}
          {source === "csv" && (
            <div className={`import-step${step === 2 ? " active" : ""}`}>
              {matchedName && <div className="preset-hint on"><i aria-hidden="true" className="ti ti-bookmark" /> <span>Format reconnu : <strong>{matchedName}</strong> — appliqué automatiquement.</span></div>}
              <div className="preset-bar">
                <i aria-hidden="true" className="ti ti-bookmark" />
                <div className="select" style={{ minWidth: 190 }}>
                  <select aria-label="Formats enregistrés" value={templateSel} onChange={(e) => setTemplateSel(e.target.value)}>
                    <option value="">{templates.length ? "Formats enregistrés…" : "Aucun format enregistré"}</option>
                    {templates.map((p) => <option key={p.id} value={p.name}>{p.name}{p.bankId ? ` · ${banks.find((b) => b.id === p.bankId)?.name ?? ""}` : ""}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-ghost" disabled={!templateSel} onClick={() => { const p = templates.find((x) => x.name === templateSel); if (p) applySaved(p) }}><i aria-hidden="true" className="ti ti-wand" /> Appliquer</button>
                <button type="button" className="btn btn-ghost" title="Supprimer ce format" aria-label="Supprimer ce format" disabled={!templateSel} onClick={() => void deleteSaved()}><i aria-hidden="true" className="ti ti-trash" /></button>
                <div style={{ flex: 1 }} />
                <input className="preset-input" type="text" aria-label="Nom du format" placeholder={templateSel || "Nom du format (ex. BNP courant)"} value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                <button type="button" className="btn btn-primary" disabled={!step2Ready} onClick={() => void saveTemplate(templateName || templateSel)}><i aria-hidden="true" className="ti ti-device-floppy" /> {templateName || !templateSel ? "Enregistrer" : "Mettre à jour"}</button>
              </div>
              {templateMsg && <div className={`preset-msg${templateMsg.ok ? " ok" : ""}`} role="status">{templateMsg.text}</div>}

              <div className="field-row">
                <div className="field"><label htmlFor="csv-sep">Séparateur</label>
                  <select id="csv-sep" value={t.separator} onChange={(e) => patch({ separator: e.target.value })}>{Object.entries(SEP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="field"><label htmlFor="csv-skip">Lignes à ignorer avant l&apos;en-tête</label>
                  <input id="csv-skip" type="number" min={0} max={50} value={t.skipLines} onChange={(e) => patch({ skipLines: Math.max(0, Math.min(50, Number(e.target.value) || 0)), dateCol: "", labelCol: "", amountCol: "", debitCol: "", creditCol: "" })} />
                  <div className="field-hint">Certaines banques ajoutent des lignes (compte, période…) au-dessus des colonnes.</div></div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="csv-date">Format de date</label>
                  <select id="csv-date" value={t.dateFormat} onChange={(e) => patch({ dateFormat: e.target.value as CsvTemplate["dateFormat"] })}>{DATE_FORMATS.map((f) => <option key={f} value={f}>{DATE_LABELS[f]}</option>)}</select></div>
                <div className="field"><label htmlFor="csv-dec">Décimale des montants</label>
                  <select id="csv-dec" value={t.decimal} onChange={(e) => patch({ decimal: e.target.value as "," | "." })}><option value=",">Virgule (1 234,56)</option><option value=".">Point (1,234.56)</option></select></div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="csv-dcol">Colonne date</label>
                  <select id="csv-dcol" value={t.dateCol} onChange={(e) => patch({ dateCol: e.target.value })}>{colOptions(true)}</select></div>
                <div className="field"><label htmlFor="csv-lcol">Colonne libellé</label>
                  <select id="csv-lcol" value={t.labelCol} onChange={(e) => patch({ labelCol: e.target.value })}>{colOptions(true)}</select></div>
              </div>
              <div className="field">
                <label>Montants</label>
                <div className="type-toggle">
                  <button type="button" className={`type-opt${t.amountMode === "single" ? " active" : ""}`} onClick={() => patch({ amountMode: "single" })}>Une colonne montant</button>
                  <button type="button" className={`type-opt${t.amountMode === "split" ? " active" : ""}`} onClick={() => patch({ amountMode: "split" })}>Débit / Crédit séparés</button>
                </div>
              </div>
              {t.amountMode === "single" ? (
                <>
                  <div className="field"><label htmlFor="csv-acol">Colonne montant</label>
                    <select id="csv-acol" value={t.amountCol} onChange={(e) => patch({ amountCol: e.target.value })}>{colOptions(true)}</select></div>
                  <label className="set-row" style={{ cursor: "pointer" }}>
                    <div className="flex-1"><div className="set-name">Inverser le signe</div><div className="set-desc">À cocher si les dépenses sont positives dans le fichier (cartes de crédit, certains exports).</div></div>
                    <input type="checkbox" role="switch" aria-label="Inverser le signe des montants" checked={t.invertSign} onChange={(e) => patch({ invertSign: e.target.checked })} />
                  </label>
                </>
              ) : (
                <div className="field-row">
                  <div className="field"><label htmlFor="csv-dbcol">Colonne débit</label>
                    <select id="csv-dbcol" value={t.debitCol} onChange={(e) => patch({ debitCol: e.target.value })}>{colOptions(true)}</select></div>
                  <div className="field"><label htmlFor="csv-crcol">Colonne crédit</label>
                    <select id="csv-crcol" value={t.creditCol} onChange={(e) => patch({ creditCol: e.target.value })}>{colOptions(true)}</select></div>
                </div>
              )}

              <div className={`preset-msg${parsed.rows.length ? " ok" : ""}`} role="status" data-testid="parse-summary">
                {parsed.rows.length} opération{parsed.rows.length > 1 ? "s" : ""} lue{parsed.rows.length > 1 ? "s" : ""}
                {parsed.issues.length > 0 && <> · <strong>{parsed.issues.length} ligne{parsed.issues.length > 1 ? "s" : ""} ignorée{parsed.issues.length > 1 ? "s" : ""}</strong> ({parsed.issues.slice(0, 3).map((i) => `ligne ${i.line} : ${i.reason}`).join(" ; ")}{parsed.issues.length > 3 ? "…" : ""})</>}
              </div>
              {tokens.length > 0 && (
                <div className="raw-preview">
                  <div className="rp-title">Aperçu du fichier à partir de la ligne {t.skipLines + 1}</div>
                  <div className="wizard-preview-scroll">
                    <table className="rp-table">
                      <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{tokens.slice(t.skipLines + 1).filter((r) => r.some(Boolean)).slice(0, 5).map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Étape 3 : vérification / saisie */}
          <div className={`import-step${step === 3 ? " active" : ""}`}>
            <div className="import-summary">
              <div className="isum">
                <div><div className="isum-lbl">{source === "manual" ? "Source" : "Fichier"}</div><div className="isum-val">{source === "manual" ? "Saisie manuelle" : fileName || "—"}</div></div>
                <div><div className="isum-lbl">Compte</div><div className="isum-val">{bank ? `${bank.name} · ` : ""}{acct?.name ?? "—"}</div></div>
                <div><div className="isum-lbl">Attribué à</div><div className="isum-val">{ownerNames.length ? ownerNames.join(", ") : "—"}</div></div>
                <div><div className="isum-lbl">Solde net</div><div className={`isum-val num ${netCents >= 0 ? "pos" : "neg"}`}>{netCents >= 0 ? "+" : "−"}{formatCents(Math.abs(netCents))}</div></div>
              </div>
              {dups > 0 && <div className="warn"><i aria-hidden="true" className="ti ti-alert-triangle" /> {dups} ligne{dups > 1 ? "s" : ""} en doublon probable avec l&apos;historique (décochée{dups > 1 ? "s" : ""} par défaut).</div>}
              {issues.length > 0 && <div className="warn" data-testid="import-issues"><i aria-hidden="true" className="ti ti-alert-triangle" /> {issues.length} ligne{issues.length > 1 ? "s" : ""} non lue{issues.length > 1 ? "s" : ""} : {issues.slice(0, 3).map((i) => `ligne ${i.line} (${i.reason})`).join(" ; ")}{issues.length > 3 ? "…" : ""}</div>}
            </div>
            <div className="preview-list">
              {view.map((row) => {
                const cat = categories.find((c) => c.id === row.categoryId)
                return (
                  <div key={row.key} className={`pv-row pv-edit${row.dup ? " dup" : ""}${row.errors.length ? " invalid" : ""}`}>
                    <input type="checkbox" aria-label="Importer cette ligne" checked={row.checked} onChange={(e) => setRow(row.key, { checked: e.target.checked })} />
                    <span className="tx-icon" style={{ width: 32, height: 32, background: `${cat?.colorHex ?? "#888780"}22`, color: cat?.colorHex ?? "#888780" }}><i aria-hidden="true" className={`ti ${cat?.icon ?? "ti-tag"}`} /></span>
                    <input type="date" aria-label="Date" className="pv-in" value={row.date} onChange={(e) => setRow(row.key, { date: e.target.value })} />
                    <input type="text" aria-label="Libellé" className="pv-in pv-name-in" placeholder="Libellé" value={row.name} onChange={(e) => setRow(row.key, { name: e.target.value })} />
                    <select aria-label="Catégorie" className="pv-cat" value={row.categoryId} onChange={(e) => setRow(row.key, { categoryId: e.target.value })}>
                      <option value="">Catégorie…</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <input type="text" inputMode="decimal" aria-label="Montant" className={`pv-in pv-amt-in num ${row.cents !== null && row.cents < 0 ? "neg" : "pos"}`} placeholder="-12,50" value={row.amountText} onChange={(e) => setRow(row.key, { amountText: e.target.value })} />
                    <button type="button" className="icon-btn" aria-label="Supprimer cette ligne" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}><i aria-hidden="true" className="ti ti-trash" /></button>
                    {row.dup && <span className="pv-raw">Doublon détecté</span>}
                    {row.errors.length > 0 && <span className="pv-raw" style={{ color: "var(--danger)" }}>À corriger : {row.errors.join(", ")}</span>}
                  </div>
                )
              })}
            </div>
            <button type="button" className="link-btn" onClick={() => setRows((prev) => [...prev, blankRow()])}><i aria-hidden="true" className="ti ti-plus" /> Ajouter une ligne</button>
            <div className="field-hint">Montant négatif = dépense, positif = revenu. Les lignes à corriger ne sont pas importées.</div>
            {importError && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {importError}</div>}
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" style={{ visibility: step === 1 ? "hidden" : "visible" }} onClick={back}>Retour</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={nextDisabled} onClick={next}>
            {nextLabel} {step < 3 && <i aria-hidden="true" className="ti ti-arrow-right" />}
          </button>
        </div>
      </div>
    </div>
  )
}
