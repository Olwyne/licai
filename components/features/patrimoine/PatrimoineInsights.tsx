"use client"
import { useEffect, useMemo } from "react"
import Link from "next/link"
import { computePortfolio } from "@/lib/finance/invest"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { householdNet, perPerson } from "@/lib/finance/succession"
import { immoSplit, rentRows } from "@/lib/finance/patrimoine"
import { eur, eurS, pc } from "@/lib/finance/format"
import { useQuoteOverrides, useStoredProfile } from "@/components/features/finance/quotes"
import { useFinanceContext } from "@/components/features/finance/useFinanceContext"
import { MiniAv } from "@/components/features/finance/ui"

export function PatrimoineInsights({ reloadKey }: { reloadKey: number }) {
  const { ctx, reload } = useFinanceContext()
  const profile = useStoredProfile()
  const quotes = useQuoteOverrides()
  useEffect(() => { if (reloadKey > 0) void reload() }, [reloadKey, reload])

  const m = useMemo(() => {
    if (!ctx) return null
    const S = computePortfolio(ctx, profile, quotes)
    const tmi = computeTax(taxInputs(ctx), situationFor(ctx)).tmi
    const people = perPerson(ctx, S)
    const tot = people.reduce((a, p) => ({ cash: a.cash + p.cash, placed: a.placed + p.placed, immo: a.immo + p.immo, debt: a.debt + p.debt, net: a.net + p.net }), { cash: 0, placed: 0, immo: 0, debt: 0, net: 0 })
    return { split: immoSplit(ctx), people, tot, tmi, rent: rentRows(ctx, tmi), net: householdNet(ctx, S) }
  }, [ctx, profile, quotes])

  if (!ctx || !m || ctx.properties.length === 0) return null
  const { split, people, tot, tmi, rent } = m
  const memberOf = (id: string) => ctx.members.find((x) => x.id === id)
  const firstRented = rent.rented[0]

  return (
    <>
      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Répartition de l&apos;immobilier net</span><Link className="card-link" href="/credits">Crédits immobiliers</Link></div>
        <div className="split-bar">
          {split.rows.map((r) => <span key={r.id} style={{ flex: Math.max(r.net, 0) || 0.01, background: r.color }} title={r.name} />)}
        </div>
        <div className="legend split-legend">
          {split.rows.map((r) => (
            <div className="legend-item" key={r.id}>
              <span className="legend-dot" style={{ background: r.color }} /><span className="legend-name">{r.name}</span>
              <span className="legend-val num private">{eur(r.net)} · {Math.round(r.w)} %</span>
            </div>
          ))}
        </div>
        {split.persons.length > 0 && (
          <>
            <div className="divider" style={{ margin: "16px 0" }} />
            <div className="pat-people">
              {split.persons.map((p) => {
                const mem = memberOf(p.id)
                return (
                  <div className="pat-person" key={p.id}>
                    <MiniAv m={mem} size={28} />
                    <div className="pat-person-info">
                      <div className="pat-person-name">{mem?.short ?? mem?.name}</div>
                      <div className="pat-person-sub">{Math.round(p.w)} % de l&apos;immobilier net du foyer</div>
                    </div>
                    <div className="num private pat-person-sum">{eur(p.net)}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Vue consolidée par personne</span>
          <span className="card-sub">Comptes et crédits partagés répartis à parts égales, immobilier au prorata des quotes-parts</span>
        </div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Personne</th><th className="r">Liquidités</th><th className="r">Placements</th><th className="r">Immobilier</th><th className="r">Dettes</th><th className="r">Patrimoine net</th><th className="r">Part</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.m.id}>
                  <td><MiniAv m={p.m} size={24} /> <span style={{ verticalAlign: 6 }}>{p.m.name}</span>
                    <span className="stat-hint">{p.m.role}{p.m.birthYear ? ` · ${ctx.year - p.m.birthYear} ans` : ""}</span></td>
                  <td className="r num private">{eur(p.cash)}</td>
                  <td className="r num private">{eur(p.placed)}</td>
                  <td className="r num private">{eur(p.immo)}</td>
                  <td className="r num private neg">− {eur(p.debt)}</td>
                  <td className="r num private">{eur(p.net)}</td>
                  <td className="r num">{pc(tot.net ? (p.net / tot.net) * 100 : 0, 1)}</td>
                </tr>
              ))}
              <tr className="tot">
                <td>Foyer</td>
                <td className="r num private">{eur(tot.cash)}</td><td className="r num private">{eur(tot.placed)}</td>
                <td className="r num private">{eur(tot.immo)}</td><td className="r num private neg">− {eur(tot.debt)}</td>
                <td className="r num private">{eur(tot.net)}</td><td className="r num">100 %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Rentabilité locative</span>
          <span className="card-sub">Régime réel · TMI {pc(tmi, 0)} + 17,2 % de prélèvements sociaux</span>
        </div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Bien</th><th className="r">Loyers/an</th><th className="r">Charges &amp; vacance</th><th className="r">Impôt</th><th className="r">Brut</th><th className="r">Net</th><th className="r">Net-net</th><th className="r">Cash-flow/mois</th></tr></thead>
            <tbody>
              {rent.rented.length === 0 && <tr><td colSpan={8}>Aucun bien loué : renseignez un loyer mensuel sur un bien « Locatif ».</td></tr>}
              {rent.rented.map(({ p, y }) => (
                <tr key={p.id}>
                  <td>{p.name}<span className="stat-hint"> {p.city}{p.surface ? ` · ${p.surface} m²` : ""}</span></td>
                  <td className="r num private">{eur(y.gross)}</td>
                  <td className="r num private">− {eur(y.charges + y.vac)}</td>
                  <td className="r num private">− {eur(y.tax)}</td>
                  <td className="r num">{pc(y.brut, 2)}</td>
                  <td className="r num">{pc(y.nette, 2)}</td>
                  <td className={`r num ${y.nn > 3 ? "pos" : ""}`}>{pc(y.nn, 2)}</td>
                  <td className={`r num private ${y.cashflow >= 0 ? "pos" : "neg"}`}>{eurS(y.cashflow)}</td>
                </tr>
              ))}
              {rent.others.map(({ p, cost, monthlyOut }) => (
                <tr key={p.id}>
                  <td>{p.name}<span className="stat-hint"> {p.type === "principale" ? "Résidence principale" : p.type === "secondaire" ? "Secondaire" : "Locatif"}</span></td>
                  <td className="r num private">—</td><td className="r num private">− {eur(cost)}</td><td className="r num private">—</td>
                  <td className="r num">—</td><td className="r num">—</td><td className="r num">—</td>
                  <td className="r num private neg">− {eur(monthlyOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {firstRented && (
          <div className="inv-note">
            Rendements calculés sur le prix d&apos;acquisition frais inclus ({eur(firstRented.y.base)}). Sur la valeur actuelle estimée, le net-net ressort à {pc(firstRented.y.onValue, 2)}.
            Les intérêts d&apos;emprunt ({eur(firstRented.y.interest)}/an) sont déduits du revenu foncier mais restent une sortie de trésorerie.
          </div>
        )}
        <div className="disclaimer sm"><i aria-hidden="true" className="ti ti-info-circle" /> <span>Simulation informative : le régime réel suppose des charges justifiées et un engagement de conservation. Ni conseil fiscal, ni conseil en investissement immobilier.</span></div>
      </div>
    </>
  )
}
