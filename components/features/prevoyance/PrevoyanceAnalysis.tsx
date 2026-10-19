"use client"
import { useEffect, useMemo, useState } from "react"
import { computePortfolio } from "@/lib/finance/invest"
import { fxRate } from "@/lib/finance/fx"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { householdNet, ifi, psLines, pvRows, succession, successionAdvice } from "@/lib/finance/succession"
import { eur, eurS, pc, pcS } from "@/lib/finance/format"
import { useQuoteOverrides, useStoredProfile } from "@/components/features/finance/quotes"
import { useFinanceContext } from "@/components/features/finance/useFinanceContext"
import { AdviceRow, FrenchTaxNotice, Kpi, LoadingOrError, MiniAv, PageHeader, StatRow } from "@/components/features/finance/ui"

const DISCLAIMER =
  "Les calculs de succession, d'IFI et de plus-values reposent sur des barèmes simplifiés et sur les données saisies dans l'application. Ils ne remplacent ni un notaire, ni un conseiller fiscal, et ne tiennent pas compte des régimes matrimoniaux, clauses bénéficiaires particulières, démembrements ou régimes de faveur applicables à votre situation. Vous demeurez seul responsable de vos décisions."

export function PrevoyanceAnalysis({ reloadKey }: { reloadKey: number }) {
  const { ctx, error, reload } = useFinanceContext()
  const [who, setWho] = useState<string>("")
  const profile = useStoredProfile()
  const quotes = useQuoteOverrides()

  useEffect(() => { void reload() }, [reloadKey, reload])

  const data = useMemo(() => {
    if (!ctx) return null
    const S = computePortfolio(ctx, profile, quotes)
    const inp = taxInputs(ctx)
    const T = computeTax(inp, situationFor(ctx))
    const owners = ctx.members.filter((m) => m.incomeMonthly > 0 && !m.isChild)
    const id = owners.find((m) => m.id === who)?.id ?? owners[0]?.id ?? ""
    const succ = id ? succession(ctx, S, id) : null
    return { S, T, owners, id, succ, ifi: ifi(ctx, S), pv: pvRows(ctx, S, T.tmi), net: householdNet(ctx, S) }
  }, [ctx, who, profile, quotes])

  if (!ctx || !data) return <LoadingOrError title="Prévoyance & transmission" sub="Succession, IFI, plus-values et prélèvements" error={error} />

  const { S, T, owners, succ, pv } = data
  const I = data.ifi
  const advice = succ ? successionAdvice(succ, S.monthly) : []
  const top = S.pos.slice().sort((a, b) => b.pv - a.pv).slice(0, 8)

  return (
    <>
      <PageHeader title="Prévoyance & transmission" sub="Succession, IFI, plus-values et prélèvements" />
      <FrenchTaxNotice />

      <div className="metrics">
        <Kpi label="Patrimoine transmissible" icon="ti-users" color="#1D9E75" value={eur(data.net)} sub="Foyer entier, dettes déduites" />
        <Kpi label="Droits de succession estimés" icon="ti-gavel" color="#D85A30" value={eur(succ?.total ?? 0)}
          sub={succ ? `Au décès de ${succ.me.short} · ${succ.kids.length} enfant${succ.kids.length > 1 ? "s" : ""}` : "Aucun membre avec revenu"}
          tone={succ?.total ? "down" : "up"} />
        <Kpi label="Plus-values latentes" icon="ti-trending-up" color="#378ADD" value={eur(S.pv)} sub={`Impôt de sortie estimé ${eur(S.pv * 0.25)}`} />
        <Kpi label="Prélèvements de l'année" icon="ti-receipt-2" color="#EF9F27" value={eur(T.totalPrel)} sub={`Taux global ${pc(T.tauxGlobal, 1)}`} />
      </div>

      {/* Transmission */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Transmission</span>
          <span className="chips" style={{ margin: 0 }}>
            {owners.map((m) => (
              <button key={m.id} className={`chip ${m.id === data.id ? "active" : ""}`} onClick={() => setWho(m.id)}>Décès de {m.short}</button>
            ))}
          </span>
        </div>
        {succ ? (
          <>
            <div className="fi-out four">
              <div><div className="pv-lbl">Patrimoine net personnel</div><div className="pv-num num private">{eur(succ.P.net)}</div></div>
              <div><div className="pv-lbl">Actif de succession</div><div className="pv-num num private">{eur(succ.estate)}</div></div>
              <div><div className="pv-lbl">Hors succession (assurance vie)</div><div className="pv-num num private">{eur(succ.avTotal)}</div></div>
              <div><div className="pv-lbl">Droits estimés</div><div className={`pv-num num private ${succ.total ? "neg" : "pos"}`}>{eur(succ.total)}</div></div>
            </div>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="dtable">
                <thead><tr><th>Héritier</th><th className="r">Part</th><th className="r">Reçu brut</th><th className="r">Abattement</th><th className="r">Base taxable</th><th className="r">Droits</th><th className="r">Net</th></tr></thead>
                <tbody>
                  {succ.rows.length === 0 && <tr><td colSpan={7}>Aucun héritier identifié : ajoutez un conjoint ou des enfants dans « Comptes &amp; foyer ».</td></tr>}
                  {succ.rows.map((h) => (
                    <tr key={h.m.id}>
                      <td><MiniAv m={h.m} /> <span style={{ verticalAlign: 5 }}>{h.m.name}</span><span className="stat-hint">{h.spouse ? "Conjoint — exonéré de droits" : "Enfant — ligne directe"}</span></td>
                      <td className="r num">{pc(h.share * 100, 0)}</td>
                      <td className="r num private">{eur(h.gross)}</td>
                      <td className="r num private">{h.spouse ? "totale" : eur(h.abat)}</td>
                      <td className="r num private">{eur(h.base)}</td>
                      <td className={`r num private ${h.tax ? "neg" : "pos"}`}>{h.tax ? eur(h.tax) : "0 €"}</td>
                      <td className="r num private">{eur(h.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-header" style={{ margin: "20px 0 12px" }}>
              <span className="card-title" style={{ fontSize: 13 }}>Assurance vie — hors succession</span>
              <span className="card-sub">Primes versées avant 70 ans : abattement de 152 500 € par bénéficiaire, puis 20 %</span>
            </div>
            <div className="table-wrap">
              <table className="dtable">
                <thead><tr><th>Bénéficiaire</th><th className="r">Capital</th><th className="r">Abattement</th><th className="r">Prélèvement</th><th className="r">Net</th></tr></thead>
                <tbody>
                  {succ.avRows.length === 0 && <tr><td colSpan={5}>Aucun bénéficiaire désigné sur les contrats de {succ.me.short}.</td></tr>}
                  {succ.avRows.map((a) => (
                    <tr key={a.m.id}>
                      <td><MiniAv m={a.m} /> <span style={{ verticalAlign: 5 }}>{a.m.name}</span><span className="stat-hint">Bénéficiaire désigné{a.isSpouse ? " · conjoint exonéré" : ""}</span></td>
                      <td className="r num private">{eur(a.gross)}</td>
                      <td className="r num private">{eur(a.abat)}</td>
                      <td className={`r num private ${a.tax ? "neg" : "pos"}`}>{a.tax ? eur(a.tax) : "0 €"}</td>
                      <td className="r num private">{eur(a.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-14" style={{ marginTop: 14 }}>
              {advice.map((a, i) => <AdviceRow key={i} a={a} />)}
            </div>
          </>
        ) : (
          <div className="empty"><i aria-hidden="true" className="ti ti-users" />Ajoutez au moins un membre avec un revenu pour simuler la transmission.</div>
        )}
      </div>

      {/* IFI + PS */}
      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Impôt sur la fortune immobilière</span><span className="card-sub">Seuil d&apos;assujettissement : 1 300 000 €</span></div>
          <div className="stat-list">
            <StatRow label="Résidence principale" value={eur(I.rp)} hint="Abattement légal de 30 % appliqué" />
            <StatRow label="Autres biens immobiliers" value={eur(I.other)} hint="Locatif et secondaire, valeur vénale" />
            <StatRow label="Immobilier détenu via les placements" value={eur(I.paper)} hint="SCI, SCPI et unités de compte immobilières" />
            <StatRow label="Dettes immobilières déductibles" value={"− " + eur(I.debt)} hint="Capital restant dû des prêts immobiliers et travaux" cls="neg" />
            <StatRow label={<b>Assiette taxable</b>} value={eur(I.base)} hint={I.liable ? "Au-dessus du seuil" : `Il reste ${eur(1300000 - I.base)} de marge avant assujettissement`} cls={I.liable ? "neg" : "pos"} />
            {I.liable
              ? <StatRow label="IFI estimé" value={eur(I.tax)} hint="Barème par tranches, décote comprise entre 1,3 et 1,4 M€" cls="neg" />
              : <StatRow label="IFI estimé" value="0 €" hint="Non redevable cette année" cls="pos" />}
          </div>
          <div className="inv-note">
            Si le patrimoine immobilier progresse de 2,4 %/an, le seuil serait franchi vers {I.crossYear} — sans nouvelle acquisition.
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Prélèvements sociaux &amp; acomptes</span><span className="card-sub">Taux de prélèvement à la source {pc(T.pasRate, 1)}</span></div>
          <div className="stat-list">
            {psLines(T, S.pv).map((l) => (
              <StatRow key={l.label} label={l.label === "Total des prélèvements de l'année" ? <b>{l.label}</b> : l.label} value={l.value} hint={l.hint} cls={l.cls} />
            ))}
          </div>
          <div className="inv-note">
            Une variation de revenus de plus de 10 % justifie une actualisation du taux de prélèvement à la source pour éviter un solde important en septembre.
          </div>
        </div>
      </div>

      {/* Plus-values latentes */}
      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Plus-values latentes &amp; fiscalité de sortie</span><span className="card-sub">Si tout était liquidé aujourd&apos;hui</span></div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Enveloppe</th><th className="r">Valeur</th><th className="r">PV latente</th><th className="r">Impôt de sortie</th><th className="r">Net perçu</th><th>Régime</th></tr></thead>
            <tbody>
              {pv.rows.length === 0 && <tr><td colSpan={6}>Aucune enveloppe de placement renseignée.</td></tr>}
              {pv.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}<span className="stat-hint">{r.kindLabel} · ouvert en {r.since} · {r.age} ans</span></td>
                  <td className="r num private">{eur(r.value)}</td>
                  <td className={`r num private ${r.gain >= 0 ? "pos" : "neg"}`}>{eurS(r.gain)}</td>
                  <td className="r num private">{eur(r.tax)}</td>
                  <td className="r num private">{eur(r.net)}</td>
                  <td>{r.label}{r.wait ? <> <span className="tag-now">{r.wait} an{r.wait > 1 ? "s" : ""} pour économiser {eur(r.saving)}</span></> : null}</td>
                </tr>
              ))}
              {pv.rows.length > 0 && (
                <tr className="tot">
                  <td>Total</td>
                  <td className="r num private">{eur(pv.tot.v)}</td>
                  <td className="r num private pos">{eurS(pv.tot.g)}</td>
                  <td className="r num private neg">{eur(pv.tot.t)}</td>
                  <td className="r num private">{eur(pv.tot.v - pv.tot.t)}</td>
                  <td>Taux moyen de sortie {pc(pv.tot.g > 0 ? (pv.tot.t / pv.tot.g) * 100 : 0, 1)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pv.gainsWait > 50 && (
          <div className="inv-note">Attendre les seuils d&apos;ancienneté sur les enveloppes concernées économiserait {eur(pv.gainsWait)} d&apos;impôt — à mettre en regard du besoin de liquidité.</div>
        )}
      </div>

      {/* Suivi du prix de revient */}
      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Suivi du prix de revient par ligne</span><span className="card-sub">8 plus fortes contributions</span></div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Support</th><th className="r">Quantité</th><th className="r">Prix de revient</th><th className="r">Valeur</th><th className="r">PV latente</th><th className="r">%</th></tr></thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={6}>Aucune ligne de portefeuille.</td></tr>}
              {top.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}<span className="stat-hint">{p.tk} · {ctx.invAccounts.find((a) => a.id === p.acct)?.name ?? ""}</span></td>
                  <td className="r num">{p.qty.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}</td>
                  <td className="r num private">{eur(p.pru * p.qty * fxRate(p.cur, ctx.fx))}</td>
                  <td className="r num private">{eur(p.value)}</td>
                  <td className={`r num private ${p.pv >= 0 ? "pos" : "neg"}`}>{eurS(p.pv)}</td>
                  <td className={`r num ${p.pv >= 0 ? "pos" : "neg"}`}>{pcS(p.pvPct, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Avertissement</span></div>
        <div className="disclaimer"><i aria-hidden="true" className="ti ti-alert-triangle" /> <span><b>Information, pas conseil.</b> {DISCLAIMER}</span></div>
      </div>
    </>
  )
}
