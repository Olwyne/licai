"use client"
import { useMemo, useState } from "react"
import { Bar } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js"
import type { Loan } from "@/db/schema"
import { addMonths, byYear, earlyRepayment, monthLabel, schedule, type EarlyMode } from "@/lib/finance/amort"
import { eur, eurS, pc } from "@/lib/finance/format"
import { StatRow } from "@/components/features/finance/ui"
import { chartColors, useThemeTick } from "@/components/features/finance/useThemeTick"

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const num = (v: string) => parseFloat((v || "0").replace(/\s/g, "").replace(",", ".")) || 0

export function AmortModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  useThemeTick()
  const c = { left: loan.remainingCents / 100, monthly: loan.monthlyPaymentCents / 100, rate: loan.ratePercent }
  const start = new Date().toISOString().slice(0, 7)
  const rows = useMemo(() => schedule(c.left, c.rate, c.monthly), [c.left, c.rate, c.monthly])
  const years = useMemo(() => byYear(rows, start), [rows, start])
  const interest = rows.reduce((s, r) => s + r.int, 0)
  const [amount, setAmount] = useState(String(Math.round(Math.min(10000, c.left * 0.5))))
  const [mode, setMode] = useState<EarlyMode>("duree")
  const [alt, setAlt] = useState(String(loan.ratePercent || 3).replace(".", ","))
  const E = earlyRepayment(c, num(amount), mode, num(alt))
  const { grid, fg, card } = chartColors()
  const impossible = rows.length === 0

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>{loan.name}</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {impossible ? (
            <div className="empty"><i className="ti ti-alert-circle" />Mensualité trop faible pour amortir le capital : vérifiez le taux et la mensualité.</div>
          ) : (
            <>
              <div className="fi-out four">
                <div><div className="pv-lbl">Capital restant</div><div className="pv-num num private">{eur(c.left)}</div></div>
                <div><div className="pv-lbl">Mensualité</div><div className="pv-num num private">{eur(c.monthly)}</div></div>
                <div><div className="pv-lbl">Intérêts restants</div><div className="pv-num num private neg">{eur(interest)}</div></div>
                <div><div className="pv-lbl">Dernière échéance</div><div className="pv-num">{monthLabel(addMonths(start, rows.length))}</div></div>
              </div>
              <div className="chart-box" style={{ height: 190, margin: "14px 0 4px" }}>
                <Bar
                  data={{
                    labels: years.map((y) => y.year),
                    datasets: [
                      { label: "Capital", data: years.map((y) => y.cap), backgroundColor: "#1D9E75", borderRadius: 4, maxBarThickness: 24 },
                      { label: "Intérêts", data: years.map((y) => y.int), backgroundColor: "#D85A30", borderRadius: 4, maxBarThickness: 24 },
                    ],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false, animation: false,
                    plugins: {
                      legend: { display: true, position: "top", align: "end", labels: { color: fg, boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: "circle", padding: 14 } },
                      tooltip: { backgroundColor: card, titleColor: fg, bodyColor: fg, callbacks: { label: (x) => `${x.dataset.label} : ${eur(x.parsed.y ?? 0)}` } },
                    },
                    scales: {
                      x: { stacked: true, grid: { display: false }, ticks: { color: fg, maxTicksLimit: 12 } },
                      y: { stacked: true, grid: { color: grid }, border: { display: false }, ticks: { color: fg, maxTicksLimit: 5 } },
                    },
                  }}
                />
              </div>

              <div className="amort-sim">
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="card-title">Remboursement anticipé</span>
                  <span className="card-sub">Indemnité plafonnée à 3 % du capital remboursé ou 6 mois d&apos;intérêts</span>
                </div>
                <div className="fi-grid three">
                  <div className="fi-field"><label>Montant remboursé</label><div className="field-amount"><input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /><span className="cur">€</span></div></div>
                  <div className="fi-field"><label>Effet</label>
                    <div className="type-toggle">
                      <button type="button" className={`type-opt ${mode === "duree" ? "active" : ""}`} onClick={() => setMode("duree")}>Réduire la durée</button>
                      <button type="button" className={`type-opt ${mode === "mensualite" ? "active" : ""}`} onClick={() => setMode("mensualite")}>Réduire la mensualité</button>
                    </div>
                  </div>
                  <div className="fi-field"><label>Rendement d&apos;un placement alternatif</label><div className="field-amount"><input type="text" inputMode="decimal" value={alt} onChange={(e) => setAlt(e.target.value)} /><span className="cur">%</span></div></div>
                </div>
                <div className="stat-list">
                  <StatRow label="Nouveau capital restant dû" value={eur(E.newLeft)} />
                  {mode === "duree"
                    ? <StatRow label="Nouvelle durée" value={`${E.newMonths} mois`} hint={`${E.months - E.newMonths} échéances de moins · fin ${monthLabel(addMonths(start, E.newMonths))}`} cls="pos" />
                    : <StatRow label="Nouvelle mensualité" value={eur(E.newMonthly)} hint={`${eurS(E.newMonthly - c.monthly)} par mois · même échéance finale`} cls="pos" />}
                  <StatRow label="Intérêts économisés" value={eur(E.saved)} hint={`Sur ${eur(E.interest)} d'intérêts restants`} cls="pos" />
                  <StatRow label="Indemnité de remboursement anticipé" value={"− " + eur(E.ira)} hint="Le plus faible des deux plafonds légaux" cls="neg" />
                  <StatRow label={<b>Gain net</b>} value={eurS(E.gain)} hint={`Rendement implicite de l'opération : ${pc(E.implicitPct, 1)} sur ${mode === "duree" ? E.months - E.newMonths : E.months} mois`} cls={E.gain > 0 ? "pos" : "neg"} />
                  <StatRow label={`Comparaison avec un placement à ${pc(num(alt), 2)}`} value={eur(E.altGain)} hint="Gain brut du placement sur la même durée, avant impôt" />
                </div>
              </div>

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="dtable">
                  <thead><tr><th>Année</th><th className="r">Échéances</th><th className="r">Capital</th><th className="r">Intérêts</th><th className="r">Restant dû</th></tr></thead>
                  <tbody>
                    {years.map((y) => (
                      <tr key={y.year}><td>{y.year}</td><td className="r">{y.n}</td><td className="r num private">{eur(y.cap)}</td><td className="r num private neg">{eur(y.int)}</td><td className="r num private">{eur(y.left)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
