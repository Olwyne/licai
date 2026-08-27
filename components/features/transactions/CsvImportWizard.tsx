"use client"
import React, { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { formatCents } from "@/lib/money"
import { mapColumns } from "@/lib/finance/csv"
import type { Account, Bank, Category, Transaction } from "@/db/schema"
import type { ParsedRow } from "@/lib/finance/csv"

interface Props {
  accounts: Account[]
  banks: Bank[]
  categories: Category[]
  txList: Transaction[]
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
    setPresetName("")
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
        body: JSON.stringify({ accountId, rows }),
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

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal import-modal">
        <div className="modal-header">
          <h2>Importer un fichier CSV</h2>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div className="import-steps">
          {([1, 2, 3] as const).map((s, idx) => (
            <React.Fragment key={s}>
              {idx > 0 && <div className="step-sep" />}
              <div
                className={`step${step === s ? " active" : step > s ? " done" : ""}`}
              >
                <span className="step-num">{step > s ? "✓" : s}</span>
                {s === 1 ? "Fichier" : s === 2 ? "Colonnes" : "Aperçu"}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1 ── */}
        <div className={`import-step${step === 1 ? " active" : ""}`}>
          <div
            className={`dropzone${isDragOver ? " over" : ""}${fileName ? " filled" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
          >
            {fileName
              ? `✓ ${fileName}`
              : "Glissez un fichier CSV ici ou cliquez pour choisir"}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
          </div>

          <div className="wizard-toolbar">
            <div className="filter-group">
              <label>Banque</label>
              <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
                <option value="">Toutes</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Compte *</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="filter-reset"
              onClick={loadSample}
              style={{ color: "var(--primary)" }}
            >
              Charger un exemple
            </button>
          </div>

          <div className="modal-footer">
            <Button variant="ghost" type="button" onClick={onClose}>Annuler</Button>
            <Button
              variant="primary"
              type="button"
              onClick={goToStep2}
              disabled={!rawCsv}
            >
              Continuer
            </Button>
          </div>
        </div>

        {/* ── Step 2 ── */}
        <div className={`import-step${step === 2 ? " active" : ""}`}>
          {presetHint && (
            <div className="preset-hint on">
              <span>Format reconnu : <strong>{presetHint.name}</strong></span>
              <button
                type="button"
                className="amode-btn active"
                onClick={() => applyPreset(presetHint)}
              >
                Appliquer
              </button>
            </div>
          )}

          <div className="wizard-col-form">
            <div className="map-row">
              <label>Séparateur</label>
              <select value={separator} onChange={(e) => setSeparator(e.target.value)}>
                <option value=";">; (point-virgule)</option>
                <option value=",">, (virgule)</option>
                <option value={"\t"}>⇥ (tabulation)</option>
              </select>
            </div>
            <div className="map-row">
              <label>Format date</label>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
            <div className="map-row">
              <label>Décimal</label>
              <select value={decimal} onChange={(e) => setDecimal(e.target.value)}>
                <option value=",">, (virgule)</option>
                <option value=".">. (point)</option>
              </select>
            </div>
            <div className="map-row">
              <label>Mode montant</label>
              <div className="amode-btns">
                <button
                  type="button"
                  className={`amode-btn${amountMode === "single" ? " active" : ""}`}
                  onClick={() => setAmountMode("single")}
                >
                  Montant unique
                </button>
                <button
                  type="button"
                  className={`amode-btn${amountMode === "split" ? " active" : ""}`}
                  onClick={() => setAmountMode("split")}
                >
                  Débit / Crédit
                </button>
              </div>
            </div>
            <div className="map-row">
              <label>Colonne date</label>
              <select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="map-row">
              <label>Colonne libellé</label>
              <select value={labelCol} onChange={(e) => setLabelCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            {amountMode === "single" ? (
              <div className="map-row">
                <label>Colonne montant</label>
                <select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                  <option value="">—</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="map-row">
                  <label>Colonne débit</label>
                  <select value={debitCol} onChange={(e) => setDebitCol(e.target.value)}>
                    <option value="">—</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="map-row">
                  <label>Colonne crédit</label>
                  <select value={creditCol} onChange={(e) => setCreditCol(e.target.value)}>
                    <option value="">—</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Preview table */}
          {previewLines.length > 0 && (
            <div className="wizard-preview-scroll">
              <table className="rp-table">
                <thead>
                  <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {previewLines.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Save preset */}
          <div className="wizard-preset-row">
            <input
              type="text"
              placeholder="Nom du format…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              style={{ padding: "6px 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--fg)", flex: 1 }}
            />
            <button type="button" className="amode-btn" onClick={handleSavePreset}>
              Enregistrer ce format
            </button>
          </div>

          <div className="modal-footer">
            <Button variant="ghost" type="button" onClick={() => setStep(1)}>Précédent</Button>
            <Button variant="primary" type="button" onClick={goToStep3}>
              Continuer
            </Button>
          </div>
        </div>

        {/* ── Step 3 ── */}
        <div className={`import-step${step === 3 ? " active" : ""}`}>
          {/* Summary */}
          <div className="isum">
            <div>
              <div className="isum-lbl">Opérations</div>
              <div className="isum-val">{checkedCount}</div>
            </div>
            <div>
              <div className="isum-lbl">Solde net</div>
              <div className="isum-val">{formatCents(netCents)}</div>
            </div>
            <div>
              <div className="isum-lbl">Doublons</div>
              <div className="isum-val">{previewRows.filter((r) => r.isDup).length}</div>
            </div>
          </div>

          {/* Preview rows */}
          <div className="wizard-pv-list">
            {previewRows.map((row, i) => (
              <div key={i} className={`pv-row${row.isDup ? " dup" : ""}`}>
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => toggleRow(i)}
                />
                <div className="pv-info">
                  <div className="pv-name">{row.name}</div>
                  {row.isDup && (
                    <div className="pv-raw" style={{ color: "var(--danger)" }}>Doublon détecté</div>
                  )}
                </div>
                <span className="pv-date">{row.date}</span>
                <span className={`pv-amt${row.amountCents >= 0 ? " pos" : " neg"}`}>
                  {formatCents(row.amountCents)}
                </span>
                <div className="pv-cat">
                  <select
                    value={row.categoryId}
                    onChange={(e) => setRowCat(i, e.target.value)}
                  >
                    <option value="">Catégorie…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {importError && <div className="err on" style={{ marginTop: 8 }}>{importError}</div>}

          <div className="modal-footer">
            <Button variant="ghost" type="button" onClick={() => setStep(2)}>Précédent</Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => void handleImport()}
              disabled={importing || checkedCount === 0}
            >
              {importing ? "Import…" : `Importer ${checkedCount} opération(s)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
