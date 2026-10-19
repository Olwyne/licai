"use client"

import { useFetch } from "@/lib/use-fetch"
import { useRouter } from "next/navigation"
import { formatCents } from "@/lib/money"

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return `${MONTHS_FR[m - 1]} ${y}`
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  return `${py}-${String(pm).padStart(2, "0")}`
}

function nextMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  return `${ny}-${String(nm).padStart(2, "0")}`
}

type AccountType = "checking" | "savings" | "investment" | "other"

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Courant",
  savings: "Épargne",
  investment: "Investissement",
  other: "Autre",
}

interface RapportData {
  month: string
  household: { name: string | null }
  members: Array<{ id: string; name: string; monthlyIncomeCents: number }>
  accounts: Array<{ id: string; name: string; balanceCents: number; type: AccountType }>
  transactions: Array<{
    id: string
    name: string
    amountCents: number
    date: string
    categoryLabel: string
    categoryColor: string
    categoryIcon: string
  }>
  budgets: Array<{
    id: string
    categoryId: string
    categoryLabel: string
    limitCents: number
    spentCents: number
  }>
  expensesByCategory: Array<{
    categoryId: string
    categoryLabel: string
    categoryColor: string
    amountCents: number
  }>
  kpis: {
    totalIncomeCents: number
    totalExpensesCents: number
    balanceCents: number
    savingsRate: number
  }
}

interface Props {
  month: string
  householdId: string
}

export function RapportView({ month }: Props) {
  const router = useRouter()
  const { data, error: fetchError, loading } = useFetch<RapportData>(`/api/rapport?month=${month}`, "Erreur de chargement")
  const error = fetchError || null

  const goMonth = (m: string) => {
    router.push(`/rapport?month=${m}`)
  }

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  if (loading) {
    return (
      <div className="rapport-page">
        <div className="rapport-loading">Chargement du rapport…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rapport-page">
        <div className="rapport-error">Impossible de charger le rapport : {error}</div>
      </div>
    )
  }

  const { kpis, expensesByCategory, transactions: txList, accounts, budgets } = data

  // Budget map by categoryId
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]))

  return (
    <div className="rapport-page">
      {/* Controls — hidden in print */}
      <div className="rapport-controls no-print">
        <div className="rapport-nav">
          <button
            className="rapport-nav-btn"
            onClick={() => goMonth(prevMonth(month))}
            aria-label="Mois précédent"
          >
            <i aria-hidden="true" className="ti ti-chevron-left" />
          </button>
          <span className="rapport-month-label">{formatMonth(month)}</span>
          <button
            className="rapport-nav-btn"
            onClick={() => goMonth(nextMonthStr(month))}
            aria-label="Mois suivant"
          >
            <i aria-hidden="true" className="ti ti-chevron-right" />
          </button>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>
          <i aria-hidden="true" className="ti ti-file-download" />
          Télécharger PDF
        </button>
      </div>

      {/* Report content */}
      <div className="rapport-header">
        <div className="rapport-title">Rapport mensuel — {formatMonth(month)}</div>
        {data.household.name && (
          <div className="rapport-sub">{data.household.name}</div>
        )}
        <div className="rapport-sub">Généré le {today}</div>
      </div>

      {/* KPIs */}
      <div className="rapport-kpis">
        <div className="rapport-kpi">
          <div className="rapport-kpi-label">REVENUS</div>
          <div className="rapport-kpi-val pos">{formatCents(kpis.totalIncomeCents)}</div>
        </div>
        <div className="rapport-kpi">
          <div className="rapport-kpi-label">DÉPENSES</div>
          <div className="rapport-kpi-val neg">{formatCents(kpis.totalExpensesCents)}</div>
        </div>
        <div className="rapport-kpi">
          <div className="rapport-kpi-label">SOLDE</div>
          <div className={`rapport-kpi-val ${kpis.balanceCents >= 0 ? "pos" : "neg"}`}>
            {formatCents(kpis.balanceCents)}
          </div>
        </div>
        <div className="rapport-kpi">
          <div className="rapport-kpi-label">TAUX D&apos;ÉPARGNE</div>
          <div className={`rapport-kpi-val ${kpis.savingsRate >= 0 ? "pos" : "neg"}`}>
            {kpis.savingsRate.toFixed(1)} %
          </div>
        </div>
      </div>

      {/* Expenses by category */}
      <div className="rapport-section">
        <div className="rapport-section-title">Dépenses par catégorie</div>
        {expensesByCategory.length === 0 ? (
          <div className="rapport-empty">Aucune dépense ce mois</div>
        ) : (
          <table className="rapport-table">
            <thead>
              <tr>
                <th className="rapport-th">Catégorie</th>
                <th className="rapport-th rapport-td-right">Montant</th>
                <th className="rapport-th rapport-td-right">% des dépenses</th>
                <th className="rapport-th rapport-td-right">Budget</th>
              </tr>
            </thead>
            <tbody>
              {expensesByCategory.map((cat) => {
                const pct =
                  kpis.totalExpensesCents > 0
                    ? (cat.amountCents / kpis.totalExpensesCents) * 100
                    : 0
                const budget = budgetMap.get(cat.categoryId)
                return (
                  <tr key={cat.categoryId}>
                    <td className="rapport-td">
                      <span
                        className="rapport-cat-dot"
                        style={{ '--cat-color': cat.categoryColor } as React.CSSProperties}
                      />
                      {cat.categoryLabel}
                    </td>
                    <td className="rapport-td rapport-td-right">{formatCents(cat.amountCents)}</td>
                    <td className="rapport-td rapport-td-right">{pct.toFixed(1)} %</td>
                    <td className="rapport-td rapport-td-right">
                      {budget ? formatCents(budget.limitCents) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Transactions */}
      <div className="rapport-section">
        <div className="rapport-section-title">Transactions du mois</div>
        {txList.length === 0 ? (
          <div className="rapport-empty">Aucune transaction ce mois</div>
        ) : (
          <table className="rapport-table">
            <thead>
              <tr>
                <th className="rapport-th">Date</th>
                <th className="rapport-th">Libellé</th>
                <th className="rapport-th">Catégorie</th>
                <th className="rapport-th rapport-td-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {txList.map((tx) => (
                <tr key={tx.id}>
                  <td className="rapport-td rapport-td-mono">{tx.date}</td>
                  <td className="rapport-td">{tx.name}</td>
                  <td className="rapport-td">
                    {tx.categoryLabel ? (
                      <>
                        <span
                          className="rapport-cat-dot"
                          style={{ background: tx.categoryColor } as React.CSSProperties}
                        />
                        {tx.categoryLabel}
                      </>
                    ) : (
                      <span className="rapport-muted">—</span>
                    )}
                  </td>
                  <td className={`rapport-td rapport-td-right ${tx.amountCents >= 0 ? "pos" : "neg"}`}>
                    {formatCents(tx.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Accounts */}
      <div className="rapport-section">
        <div className="rapport-section-title">Comptes</div>
        {accounts.length === 0 ? (
          <div className="rapport-empty">Aucun compte</div>
        ) : (
          <table className="rapport-table">
            <thead>
              <tr>
                <th className="rapport-th">Compte</th>
                <th className="rapport-th">Type</th>
                <th className="rapport-th rapport-td-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td className="rapport-td">{acc.name}</td>
                  <td className="rapport-td">{ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}</td>
                  <td className={`rapport-td rapport-td-right ${acc.balanceCents >= 0 ? "pos" : "neg"}`}>
                    {formatCents(acc.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rapport-footer">
        Généré par Lǐcái · {today}
      </div>
    </div>
  )
}
