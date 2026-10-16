"use client"
import React, { useCallback, useRef, useState } from "react"
import { MiniAv } from "@/components/features/finance/ui"
import { formatCents } from "@/lib/money"
import { mapColumns } from "@/lib/finance/csv"
import type { Account, Bank, Category, Member, Transaction } from "@/db/schema"
import type { ParsedRow } from "@/lib/finance/csv"

interface Props {
  accounts: Account[]
  banks: Bank[]
  categories: Category[]
  txList: Transaction[]
  members: Member[]
  onImported: (txs: Transaction[]) => void
  onClose: () => void
}

interface PreviewRow {
  date: string
  name: string
  amountCents: number
  categoryId: string
  checked: boolean
  isDup: boolean
}

interface CsvPreset {
  name: string
  separator: string
  decimal: string
  dateFormat: string
  amountMode: "single" | "split"
  dateCol: string
  labelCol: string
  amountCol: string
  debitCol: string
  creditCol: string
}

interface ImportApiResponse {
  data: { imported: number }
}

interface CreatedTxApiResponse {
  data: Transaction[]
}

function detectSep(raw: string): string {
  const line = raw.split("\n")[0] ?? ""
  if (line.includes(";")) return ";"
  if (line.includes("\t")) return "\t"
  return ","
}

function parseCsvLines(raw: string, sep: string): string[][] {
  return raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")))
}

function loadPresets(): CsvPreset[] {
  try {
    return JSON.parse(localStorage.getItem("licai-csv-presets") ?? "[]") as CsvPreset[]
  } catch {
    return []
  }
}

function savePreset(p: CsvPreset) {
  try {
    const existing = loadPresets().filter((x) => x.name !== p.name)
    localStorage.setItem("licai-csv-presets", JSON.stringify([p, ...existing]))
  } catch {
    // ignore
  }
}

const SAMPLE_CSV = `Date;Libellé;Débit;Crédit
01/08/2026;Courses Monoprix;87.40;
02/08/2026;Netflix;13.99;
15/08/2026;Salaire;;2800.00
20/08/2026;EDF;120.00;`

export function CsvImportWizard({
  accounts,
  banks,
  categories,
  txList,
  members,
  onImported,
  onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 1
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rawCsv, setRawCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [bankId, setBankId] = useState(banks[0]?.id ?? "")
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [isDragOver, setIsDragOver] = useState(false)
  const [owners, setOwners] = useState<string[]>([])
  const [presets, setPresets] = useState<CsvPreset[]>(() => (typeof window === "undefined" ? [] : loadPresets()))
  const [presetSel, setPresetSel] = useState("")
  const [presetMsg, setPresetMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Step 2
  const [separator, setSeparator] = useState(";")
  const [decimal, setDecimal] = useState(",")
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY")
  const [amountMode, setAmountMode] = useState<"single" | "split">("split")
  const [headers, setHeaders] = useState<string[]>([])
  const [dateCol, setDateCol] = useState("")
  const [labelCol, setLabelCol] = useState("")
  const [amountCol, setAmountCol] = useState("")
  const [debitCol, setDebitCol] = useState("")
  const [creditCol, setCreditCol] = useState("")
  const [previewLines, setPreviewLines] = useState<string[][]>([])
  const [presetHint, setPresetHint] = useState<CsvPreset | null>(null)
  const [presetName, setPresetName] = useState("")

  // Step 3
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")

  // ── Step 1 helpers ──

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? ""
      setRawCsv(text)
      setFileName(file.name)
    }
    reader.readAsText(file, "utf-8")
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  function loadSample() {
    setRawCsv(SAMPLE_CSV)
    setFileName("example.csv")
  }

  function goToStep2() {
    if (!rawCsv) return
    const sep = detectSep(rawCsv)
    setSeparator(sep)
    const lines = parseCsvLines(rawCsv, sep)
    const hdrs = lines[0] ?? []
    setHeaders(hdrs)
    setPreviewLines(lines.slice(1, 5))

    // Auto-guess columns
    setDateCol(hdrs.find((h) => h.toLowerCase().includes("date")) ?? hdrs[0] ?? "")
    setLabelCol(
      hdrs.find((h) =>
        ["libellé", "label", "description", "name", "libelle"].some((k) =>
          h.toLowerCase().includes(k)
        )
      ) ?? hdrs[1] ?? ""
    )
    setDebitCol(hdrs.find((h) => h.toLowerCase().includes("débit") || h.toLowerCase() === "debit") ?? "")
    setCreditCol(hdrs.find((h) => h.toLowerCase().includes("crédit") || h.toLowerCase() === "credit") ?? "")
    setAmountCol(hdrs.find((h) => h.toLowerCase().includes("amount") || h.toLowerCase().includes("montant")) ?? "")

    // Check for saved preset
    const presets = loadPresets()
    const matched = presets.find(
      (p) => p.separator === sep && hdrs.includes(p.dateCol) && hdrs.includes(p.labelCol)
    )
    if (matched) {
      setPresetHint(matched)
      setDecimal(matched.decimal)
      setDateFormat(matched.dateFormat)
      setAmountMode(matched.amountMode)
      setDateCol(matched.dateCol)
      setLabelCol(matched.labelCol)
      setAmountCol(matched.amountCol)
      setDebitCol(matched.debitCol)
      setCreditCol(matched.creditCol)
    } else {
      setPresetHint(null)
    }

    setStep(2)
  }

  // ── Step 2 helpers ──

  const reparse = useCallback(
    (
      sep: string,
      dec: string,
      dfmt: string,
      dCol: string,
      lCol: string,
      aCol: string,
      dbCol: string,
      crCol: string,
      mode: "single" | "split"
    ) => {
      const lines = parseCsvLines(rawCsv, sep)
      const hdrs = lines[0] ?? []
      setHeaders(hdrs)
      setPreviewLines(lines.slice(1, 5))

      const dataLines = lines.slice(1).filter((l) => l.some((c) => c !== ""))
      const parsed: ParsedRow[] = dataLines.map((cols) => {
        const row: Record<string, string> = {}
        hdrs.forEach((h, i) => { row[h] = cols[i] ?? "" })
        return mapColumns(
          row,
          {
            dateCol: dCol,
            labelCol: lCol,
            amountCol: mode === "single" ? aCol : undefined,
            debitCol: mode === "split" ? dbCol : undefined,
            creditCol: mode === "split" ? crCol : undefined,
          },
          dec,
          dfmt
        )
      })

      const rows: PreviewRow[] = parsed.map((r) => {
        const isDup = txList.some(
          (t) => t.date === r.date && Math.abs(t.amountCents - Math.abs(r.amountCents)) < 1
        )
        return { ...r, categoryId: "", checked: !isDup, isDup }
      })

      return rows
    },
    [rawCsv, txList]
  )

  function applyPreset(p: CsvPreset) {
    setSeparator(p.separator)
    setDecimal(p.decimal)
    setDateFormat(p.dateFormat)
    setAmountMode(p.amountMode)
    setDateCol(p.dateCol)
    setLabelCol(p.labelCol)
    setAmountCol(p.amountCol)
    setDebitCol(p.debitCol)
    setCreditCol(p.creditCol)
    setPresetHint(null)
  }

  function handleSavePreset() {
    const n = presetName.trim() || "Mon format"
    const p: CsvPreset = {
      name: n,
      separator,
      decimal,
      dateFormat,
      amountMode,
      dateCol,
      labelCol,
      amountCol,
      debitCol,
      creditCol,
    }
    savePreset(p)
    setPresets(loadPresets())
    setPresetSel(n)
    setPresetMsg({ text: `Format « ${n} » enregistré.`, ok: true })
    setPresetName("")
  }

  function deletePreset() {
    if (!presetSel) return
    try { localStorage.setItem("licai-csv-presets", JSON.stringify(loadPresets().filter((x) => x.name !== presetSel))) } catch { /* indisponible */ }
    setPresets(loadPresets())
    setPresetMsg({ text: `Format « ${presetSel} » oublié.`, ok: false })
    setPresetSel("")
  }

  function goToStep3() {
    const rows = reparse(separator, decimal, dateFormat, dateCol, labelCol, amountCol, debitCol, creditCol, amountMode)
    setPreviewRows(rows)
    setStep(3)
  }

  // ── Step 3 helpers ──

  function toggleRow(i: number) {
    setPreviewRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, checked: !r.checked } : r))
    )
  }

  function setRowCat(i: number, catId: string) {
    setPreviewRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, categoryId: catId } : r))
    )
  }

  async function handleImport() {
    const toImport = previewRows.filter((r) => r.checked)
    if (toImport.length === 0) return
    if (!accountId) { setImportError("Veuillez sélectionner un compte."); return }

    setImporting(true)
    setImportError("")

    try {
      const rows = toImport.map((r) => ({
        name: r.name,
        amountCents: r.amountCents,
        date: r.date,
        categoryId: r.categoryId || undefined,
      }))

      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, rows, ownerIds: owners }),
      })

      if (!res.ok) {
        setImportError("Erreur lors de l'import.")
        return
      }

      const json = (await res.json()) as ImportApiResponse
      const imported = json.data.imported

      // Fetch newly created transactions to update state optimistically
      // We approximate by building local Transaction-like objects for each imported row
      // (The API doesn't return the created rows, so we re-fetch them)
      const listRes = await fetch(`/api/transactions?accountId=${accountId}`)
      if (listRes.ok) {
        const listJson = (await listRes.json()) as CreatedTxApiResponse
        // Take the most recently imported ones (by count)
        const newTxs = listJson.data.slice(0, imported)
        onImported(newTxs)
      } else {
        onImported([])
      }
    } catch {
      setImportError("Erreur réseau.")
    } finally {
      setImporting(false)
    }
  }

  const checkedCount = previewRows.filter((r) => r.checked).length
  const netCents = previewRows.filter((r) => r.checked).reduce((s, r) => s + r.amountCents, 0)

  const filteredAccounts = bankId
    ? accounts.filter((a) => a.bankId === bankId)
    : accounts

  const acct = accounts.find((a) => a.id === accountId)
  const bank = banks.find((b) => b.id === acct?.bankId)
  const dups = previewRows.filter((r) => r.isDup).length
  const ownerNames = members.filter((m) => owners.includes(m.id)).map((m) => m.short || m.name)
  const toMini = (m: Member) => ({ id: m.id, name: m.name, short: m.short, role: m.role, color: m.colorHex, incomeMonthly: 0, birthYear: null, isChild: false })
  const nextLabel = step === 3 ? (importing ? "Import…" : `Importer ${checkedCount} opération${checkedCount > 1 ? "s" : ""}`) : "Continuer"
  const nextDisabled = step === 1 ? !rawCsv || !accountId : step === 3 ? importing || checkedCount === 0 : false
  const fmtDate = (d: string) => d.split("-").reverse().join("/")

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>Importer un relevé CSV</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>

        <div className="steps">
          {([[1, "Fichier & compte"], [2, "Colonnes"], [3, "Vérification"]] as const).map(([n, label]) => (
            <div key={n} className={`step${step === n ? " active" : step > n ? " done" : ""}`}>
              <span className="step-n">{step > n ? "✓" : n}</span> {label}
            </div>
          ))}
        </div>

        <div className="modal-body">
          {/* Étape 1 */}
          <div className={`import-step${step === 1 ? " active" : ""}`}>
            <label
              className={`dropzone${isDragOver ? " over" : ""}${fileName ? " filled" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={handleFileInput} />
              <i className="ti ti-upload dz-ic" />
              <div className="dz-title">Dépose ton fichier CSV ici</div>
              <div className="dz-sub">ou clique pour parcourir · CSV exporté depuis ta banque</div>
              <div className="dz-file">{fileName ? `✓ ${fileName}` : ""}</div>
            </label>
            <button type="button" className="link-btn" onClick={loadSample}><i className="ti ti-flask" /> Utiliser un relevé d&apos;exemple</button>
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
            {presetHint && <div className="preset-hint on"><i className="ti ti-bookmark" /> <span>Format reconnu : <strong>{presetHint.name}</strong></span></div>}
            <div className="field">
              <label>Attribuer les opérations à</label>
              <div className="owner-picker">
                {members.filter((m) => !m.isChild).map((m) => (
                  <button key={m.id} type="button" className={`owner-opt${owners.includes(m.id) ? " on" : ""}`}
                    onClick={() => setOwners((o) => (o.includes(m.id) ? o.filter((x) => x !== m.id) : [...o, m.id]))}>
                    <MiniAv m={toMini(m)} size={24} /> {m.short || m.name}
                  </button>
                ))}
              </div>
              <div className="field-hint">Plusieurs personnes = dépense partagée du foyer.</div>
            </div>
          </div>

          {/* Étape 2 */}
          <div className={`import-step${step === 2 ? " active" : ""}`}>
            <div className="preset-bar">
              <i className="ti ti-bookmark" />
              <div className="select" style={{ minWidth: 190 }}>
                <select value={presetSel} onChange={(e) => setPresetSel(e.target.value)}>
                  <option value="">{presets.length ? "Formats enregistrés…" : "Aucun format enregistré"}</option>
                  {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-ghost" disabled={!presetSel} onClick={() => { const p = presets.find((x) => x.name === presetSel); if (p) { applyPreset(p); setPresetMsg({ text: `Format « ${p.name} » appliqué.`, ok: true }) } }}><i className="ti ti-wand" /> Appliquer</button>
              <button type="button" className="btn btn-ghost" title="Oublier ce format" disabled={!presetSel} onClick={deletePreset}><i className="ti ti-trash" /></button>
              <div style={{ flex: 1 }} />
              <input className="preset-input" type="text" placeholder="Nom du format" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
              <button type="button" className="btn btn-primary" onClick={handleSavePreset}><i className="ti ti-device-floppy" /> Enregistrer</button>
            </div>
            {presetMsg && <div className={`preset-msg${presetMsg.ok ? " ok" : ""}`}>{presetMsg.text}</div>}
            <div className="field-row">
              <div className="field"><label>Séparateur</label>
                <select value={separator} onChange={(e) => setSeparator(e.target.value)}>
                  <option value=";">Point-virgule ;</option><option value=",">Virgule ,</option><option value={"\t"}>Tabulation</option>
                </select></div>
              <div className="field"><label>Format de date</label>
                <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                  <option value="DD/MM/YYYY">JJ/MM/AAAA</option><option value="YYYY-MM-DD">AAAA-MM-JJ</option><option value="MM/DD/YYYY">MM/JJ/AAAA</option>
                </select></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Colonne date</label>
                <select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
              <div className="field"><label>Colonne libellé</label>
                <select value={labelCol} onChange={(e) => setLabelCol(e.target.value)}>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
            </div>
            <div className="field">
              <label>Montants</label>
              <div className="type-toggle">
                <button type="button" className={`type-opt${amountMode === "single" ? " active" : ""}`} onClick={() => setAmountMode("single")}>Une colonne montant</button>
                <button type="button" className={`type-opt${amountMode === "split" ? " active" : ""}`} onClick={() => setAmountMode("split")}>Débit / Crédit séparés</button>
              </div>
            </div>
            {amountMode === "single" ? (
              <div className="field-row">
                <div className="field"><label>Colonne montant</label>
                  <select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}><option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
                <div className="field"><label>Décimale</label>
                  <select value={decimal} onChange={(e) => setDecimal(e.target.value)}><option value=",">Virgule (1 234,56)</option><option value=".">Point (1,234.56)</option></select></div>
              </div>
            ) : (
              <div className="field-row">
                <div className="field"><label>Colonne débit</label>
                  <select value={debitCol} onChange={(e) => setDebitCol(e.target.value)}><option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
                <div className="field"><label>Colonne crédit</label>
                  <select value={creditCol} onChange={(e) => setCreditCol(e.target.value)}><option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
              </div>
            )}
            {previewLines.length > 0 && (
              <div className="raw-preview">
                <div className="rp-title">Aperçu des {previewLines.length} premières lignes</div>
                <div className="wizard-preview-scroll">
                  <table className="rp-table">
                    <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{previewLines.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Étape 3 */}
          <div className={`import-step${step === 3 ? " active" : ""}`}>
            <div className="import-summary">
              <div className="isum">
                <div><div className="isum-lbl">Fichier</div><div className="isum-val">{fileName || "—"}</div></div>
                <div><div className="isum-lbl">Compte</div><div className="isum-val">{bank ? `${bank.name} · ` : ""}{acct?.name ?? "—"}</div></div>
                <div><div className="isum-lbl">Attribué à</div><div className="isum-val">{ownerNames.length ? ownerNames.join(", ") : "—"}</div></div>
                <div><div className="isum-lbl">Solde net</div><div className={`isum-val num ${netCents >= 0 ? "pos" : "neg"}`}>{netCents >= 0 ? "+" : "−"}{formatCents(Math.abs(netCents))}</div></div>
              </div>
              {dups > 0 && <div className="warn"><i className="ti ti-alert-triangle" /> {dups} ligne{dups > 1 ? "s" : ""} ignorée{dups > 1 ? "s" : ""} — doublon probable avec l&apos;historique.</div>}
            </div>
            <div className="preview-list">
              {previewRows.map((row, i) => {
                const cat = categories.find((c) => c.id === row.categoryId)
                return (
                  <label key={i} className={`pv-row${row.isDup ? " dup" : ""}`}>
                    <input type="checkbox" checked={row.checked} onChange={() => toggleRow(i)} />
                    <span className="tx-icon" style={{ width: 32, height: 32, background: `${cat?.colorHex ?? "#888780"}22`, color: cat?.colorHex ?? "#888780" }}><i className={`ti ${cat?.icon ?? "ti-tag"}`} /></span>
                    <span className="pv-info"><span className="pv-name">{row.name}</span>{row.isDup && <span className="pv-raw">Doublon détecté</span>}</span>
                    <select className="pv-cat" value={row.categoryId} onChange={(e) => setRowCat(i, e.target.value)}>
                      <option value="">Catégorie…</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <span className="pv-date">{fmtDate(row.date)}</span>
                    <span className={`pv-amt num ${row.amountCents >= 0 ? "pos" : "neg"}`}>{row.amountCents >= 0 ? "+" : "−"}{formatCents(Math.abs(row.amountCents))}</span>
                  </label>
                )
              })}
            </div>
            {importError && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {importError}</div>}
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" style={{ visibility: step === 1 ? "hidden" : "visible" }} onClick={() => setStep(step === 3 ? 2 : 1)}>Retour</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={nextDisabled} onClick={() => (step === 1 ? goToStep2() : step === 2 ? goToStep3() : void handleImport())}>
            {nextLabel} {step < 3 && <i className="ti ti-arrow-right" />}
          </button>
        </div>
      </div>
    </div>
  )
}
