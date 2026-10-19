import { getBaseCurrency } from "@/lib/finance/fx"
import type { ReactNode } from "react"
import type { Advice } from "@/lib/finance/format"
import { initials } from "@/lib/finance/format"
import type { CtxMember } from "@/lib/finance/types"

export const DISCLAIMER_INVEST =
  "Les analyses et suggestions de Lǐcái sont fournies à titre purement informatif et ne constituent ni un conseil en investissement, ni une recommandation personnalisée, ni un conseil fiscal ou juridique. Les performances passées ne préjugent pas des performances futures et tout placement comporte un risque de perte en capital. Vous demeurez seul responsable de vos décisions ; Lǐcái ne peut être tenu responsable d'une perte financière ou d'un redressement qui en résulterait. Pour toute opération importante, consultez un conseiller habilité."

export function Disclaimer({ children, small }: { children?: ReactNode; small?: boolean }) {
  return (
    <div className={`disclaimer${small ? " sm" : ""}`}>
      <i aria-hidden="true" className="ti ti-alert-triangle" />
      <span><b>Information, pas conseil.</b> {children ?? DISCLAIMER_INVEST}</span>
    </div>
  )
}

export function Kpi({ label, icon, color, value, sub, tone }: {
  label: string; icon: string; color: string; value: ReactNode; sub: ReactNode; tone?: "up" | "down" | "neutral"
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-ic" style={{ background: `${color}1f`, color }}><i aria-hidden="true" className={`ti ${icon}`} /></span>
      </div>
      <div className="metric-value num private">{value}</div>
      <div className={`metric-sub ${tone ?? "neutral"}`}>{sub}</div>
    </div>
  )
}

export function StatRow({ label, value, hint, cls }: { label: ReactNode; value: ReactNode; hint?: ReactNode; cls?: string }) {
  return (
    <div className="stat-row">
      <span className="stat-lbl">{label}{hint ? <span className="stat-hint">{hint}</span> : null}</span>
      <span className={`stat-val num private ${cls ?? ""}`}>{value}</span>
    </div>
  )
}

export function AdviceRow({ a, arrow = "ti-arrow-right", gainTag }: { a: Advice; arrow?: string; gainTag?: ReactNode }) {
  return (
    <div className={`adv-row ${a.sev}`}>
      <i aria-hidden="true" className={`ti ${a.icon}`} />
      <div>
        <div className="adv-title">{a.title}{gainTag}</div>
        <div className="adv-text">{a.text}</div>
        {a.action ? <div className="adv-action"><i aria-hidden="true" className={`ti ${arrow}`} /> <span>{a.action}</span></div> : null}
      </div>
    </div>
  )
}

export function MiniAv({ m, size = 22 }: { m?: CtxMember; size?: number }) {
  if (!m) return null
  return (
    <span className="mini-av" style={{ width: size, height: size, fontSize: Math.round(size / 2.5), background: `${m.color}22`, color: m.color, borderColor: `${m.color}55` }}>
      {initials(m.name)}
    </span>
  )
}

export function PageHeader({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <div className="page-sub">{sub}</div>
      </div>
      {children}
    </div>
  )
}

/** Les calculs fiscaux (barèmes, plafonds, abattements) sont ceux de la France, en euros. */
export function FrenchTaxNotice() {
  if (getBaseCurrency() === "EUR") return null
  return (
    <div className="disclaimer sm">
      <i aria-hidden="true" className="ti ti-info-circle" />
      <span>Barèmes, plafonds et abattements appliqués : ceux de la <b>fiscalité française, en euros</b>. Les montants affichés en {getBaseCurrency()} sont indicatifs : ils ne sont pas convertis avant le calcul.</span>
    </div>
  )
}

export function LoadingOrError({ title, sub, error }: { title: string; sub: string; error: string }) {
  return (
    <div>
      <PageHeader title={title} sub={sub} />
      {error
        ? <div className="empty"><i aria-hidden="true" className="ti ti-alert-circle" />{error}</div>
        : <div className="empty"><i aria-hidden="true" className="ti ti-loader" />Chargement…</div>}
    </div>
  )
}
