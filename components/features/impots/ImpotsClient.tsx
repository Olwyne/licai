"use client"
import { getBaseCurrency } from "@/lib/finance/fx"
import { useEffect, useMemo, useState } from "react"
import { computePortfolio } from "@/lib/finance/invest"
import {
  BRACKETS, DEFAULT_SITUATION, P, computeTax, situationFor, taxAdvice, taxContextNumbers, taxInputs, taxScenarios,
} from "@/lib/finance/tax"
import type { TaxSituation } from "@/lib/finance/types"
import { eur, eurS, pc } from "@/lib/finance/format"
import { loadProfile, loadQuotes, overrides } from "@/components/features/finance/quotes"
import type { ProfileKey } from "@/lib/finance/invest"
import { useFinanceContext } from "@/components/features/finance/useFinanceContext"
import { AdviceRow, Disclaimer, Kpi, LoadingOrError, PageHeader, StatRow } from "@/components/features/finance/ui"

// ─── Modal : situation fiscale ───────────────────────────────────────────────

type Draft = Record<keyof Omit<TaxSituation, "year" | "perExtra">, string>

const toDraft = (s: TaxSituation): Draft => ({
  couple: s.couple ? "1" : "0",
  dependents: String(s.dependents), youngKids: String(s.youngKids),
  fraisReels: s.fraisReels ? String(s.fraisReels) : "", foncier: s.foncier,
  chargesFoncieres: String(s.chargesFoncieres), travaux: s.travaux ? String(s.travaux) : "",
  dons: s.dons ? String(s.dons) : "", domicile: s.domicile ? String(s.domicile) : "", garde: s.garde ? String(s.garde) : "",
  autres: s.autres ? String(s.autres) : "", dividendes: s.dividendes ? String(s.dividendes) : "", interets: s.interets ? String(s.interets) : "",
})

const n = (v: string): number => parseFloat((v || "0").replace(/\s/g, "").replace(",", ".")) || 0

function SituationModal({ situation, onClose, onSave }: {
  situation: TaxSituation
  onClose: () => void
  onSave: (s: Partial<TaxSituation>) => Promise<void>
}) {
  const [d, setD] = useState<Draft>(() => toDraft(situation))
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Draft) => (v: string) => setD((p) => ({ ...p, [k]: v }))

  const amount = (label: string, k: keyof Draft, ph: string) => (
    <div className="field">
      <label>{label}</label>
      <div className="field-amount">
        <input type="text" inputMode="decimal" placeholder={ph} value={d[k]} onChange={(e) => set(k)(e.target.value)} />
        <span className="cur">€</span>
      </div>
    </div>
  )

  async function save() {
    setSaving(true)
    await onSave({
      couple: d.couple === "1", dependents: n(d.dependents), youngKids: n(d.youngKids), fraisReels: n(d.fraisReels),
      foncier: d.foncier === "micro" ? "micro" : "reel", chargesFoncieres: n(d.chargesFoncieres), travaux: n(d.travaux),
      dons: n(d.dons), domicile: n(d.domicile), garde: n(d.garde), autres: n(d.autres), dividendes: n(d.dividendes), interets: n(d.interets),
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>Situation fiscale du foyer</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field">
              <label>Déclaration</label>
              <select value={d.couple} onChange={(e) => set("couple")(e.target.value)}>
                <option value="1">Commune (mariés ou pacsés)</option>
                <option value="0">Séparée (célibataires)</option>
              </select>
            </div>
            <div className="field">
              <label>Personnes à charge</label>
              <input type="text" inputMode="numeric" placeholder="1" value={d.dependents} onChange={(e) => set("dependents")(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Dont enfants de moins de 6 ans</label>
              <input type="text" inputMode="numeric" placeholder="0" value={d.youngKids} onChange={(e) => set("youngKids")(e.target.value)} />
            </div>
            {amount("Frais réels (0 = abattement 10 %)", "fraisReels", "0")}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Régime des revenus fonciers</label>
              <select value={d.foncier} onChange={(e) => set("foncier")(e.target.value)}>
                <option value="reel">Réel (charges déductibles)</option>
                <option value="micro">Micro-foncier (−30 %)</option>
              </select>
            </div>
            {amount("Charges foncières annuelles", "chargesFoncieres", "1 200")}
          </div>
          <div className="field-row">
            {amount("Travaux déductibles de l'année", "travaux", "0")}
            {amount("Dons aux associations", "dons", "240")}
          </div>
          <div className="field-row">
            {amount("Services à domicile payés", "domicile", "0")}
            {amount("Frais de garde d'enfants", "garde", "0")}
          </div>
          <div className="field-row">
            {amount("Dividendes encaissés", "dividendes", "320")}
            {amount("Intérêts imposables", "interets", "0")}
          </div>
          <div className="field">
            <label>Autres réductions et crédits d&apos;impôt</label>
            <div className="field-amount">
              <input type="text" inputMode="decimal" placeholder="0" value={d.autres} onChange={(e) => set("autres")(e.target.value)} />
              <span className="cur">€</span>
            </div>
            <div className="field-hint">Les salaires, loyers, versements PER et intérêts d&apos;emprunt sont repris automatiquement des autres écrans.</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ marginRight: "auto" }} onClick={() => setD(toDraft({ ...DEFAULT_SITUATION, year: situation.year }))}>Valeurs par défaut</button>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><i className="ti ti-check" /> Recalculer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ImpotsClient() {
  const { ctx, error, reload } = useFinanceContext()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<ProfileKey>("equilibre")
  const [quotes, setQuotes] = useState(() => ({}) as ReturnType<typeof overrides>)

  useEffect(() => { setProfile(loadProfile()); setQuotes(overrides(loadQuotes())) }, [])

  const m = useMemo(() => {
    if (!ctx) return null
    const situation = situationFor(ctx)
    const inp = taxInputs(ctx)
    const R = computeTax(inp, situation)
    const S = computePortfolio(ctx, profile, quotes)
    return { situation, inp, R, S, advice: taxAdvice(ctx, inp, R), scen: taxScenarios(inp, R), extra: taxContextNumbers(ctx) }
  }, [ctx, profile, quotes])

  async function saveSituation(s: Partial<TaxSituation>) {
    await fetch("/api/impots", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) })
    setOpen(false)
    await reload()
  }

  if (!ctx || !m) return <LoadingOrError title="Impôts" sub="Calcul, analyse et pistes d'optimisation du foyer" error={error} />

  const { situation: sit, R, S, advice, scen, extra } = m
  const sub = `${sit.couple ? "Imposition commune" : "Déclarations séparées"} · ${R.parts.toLocaleString("fr-FR")} parts · ${sit.dependents} personne${sit.dependents > 1 ? "s" : ""} à charge · régime ${sit.foncier === "reel" ? "réel" : "micro-foncier"}`
  const salaryMembers = ctx.members.filter((x) => !x.isChild && x.incomeMonthly > 0)
  const nProps = ctx.properties.length
  const rbgPct = (v: number) => pc(R.rbg ? (v / R.rbg) * 100 : 0, 0)

  return (
    <div className="page-impots">
      <PageHeader title="Impôts" sub="Calcul, analyse et pistes d'optimisation du foyer">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><i className="ti ti-adjustments" /> Situation fiscale</button>
      </PageHeader>

      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          <span className="budget-hint">{sub}</span>
          <span className="budget-hint">· montants en {getBaseCurrency()}</span>
        </div>
      </div>

      <div className="metrics">
        <Kpi label="Impôt sur le revenu" icon="ti-receipt-tax" color="#D85A30" value={eur(R.irNet)} sub={`Taux moyen ${pc(R.tauxMoyen)} des revenus du foyer`} tone={R.tauxMoyen > 15 ? "down" : "neutral"} />
        <Kpi label="Tranche marginale" icon="ti-stairs-up" color="#EF9F27" value={pc(R.tmi, 0)}
          sub={`1 € de plus est imposé à ${pc(R.tmi, 0)}${R.foncier > 0 ? ` (${pc(R.tmi + P.ps * 100, 1)} sur les loyers)` : ""}`} />
        <Kpi label="Prélèvements totaux" icon="ti-cash-off" color="#D4537E" value={eur(R.totalPrel)}
          sub={`IR ${eur(R.irNet)} + sociaux ${eur(R.psFoncier + R.psCapitaux)} + PFU ${eur(R.irCapitaux)}`} />
        <Kpi label="Revenu net après impôt" icon="ti-wallet" color="#1D9E75" value={eur(R.revenusReels - R.totalPrel)}
          sub={`sur ${eur(R.revenusReels)} de revenus encaissés · ${pc(100 - R.tauxGlobal)} conservés`} tone="up" />
      </div>
      <div className="metrics">
        <Kpi label="Revenu net imposable" icon="ti-file-description" color="#378ADD" value={eur(R.rni)} sub={`${R.parts.toLocaleString("fr-FR")} parts · ${eur(R.rni / R.parts)} par part`} />
        <Kpi label="Taux de prélèvement à la source" icon="ti-percentage" color="#7C6BD6" value={pc(R.pasRate)} sub={`≈ ${eur(R.irNet / 12)} retenus chaque mois`} />
        <Kpi label="Réductions & crédits obtenus" icon="ti-discount" color="#1D9E75" value={eur(R.reductions)}
          sub={R.reductions ? `Dons ${eur(R.redDons)} · services ${eur(R.redDom + R.redGarde)} · autres ${eur(R.s.autres)}` : "Aucun dispositif déclaré"} tone={R.reductions ? "up" : "neutral"} />
        <Kpi label="Plafond PER restant" icon="ti-parachute" color="#EF9F27" value={eur(R.plafondPer - R.perVerse)}
          sub={`${eur(R.perVerse)} versés · gain immédiat ${eur((R.plafondPer - R.perVerse) * (R.tmi / 100))}`} />
      </div>

      <div className="grid-7-5 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Du revenu brut à l&apos;impôt</span></div>
          <div className="stat-list">
            <StatRow label="Salaires du foyer" value={eur(R.salTotal)} hint={salaryMembers.map((x) => `${x.short} ${eur(x.incomeMonthly * 12)}`).join(" · ") || "Aucun revenu renseigné"} />
            <StatRow label={R.s.fraisReels ? "Frais réels déduits" : "Abattement de 10 % (frais professionnels)"} value={"− " + eur(R.abat)} hint={R.s.fraisReels ? "option frais réels" : `plafonné à ${eur(P.absMax)} par personne`} />
            <StatRow label="Revenus fonciers nets" value={(R.foncier < 0 ? "− " : "") + eur(R.foncier)}
              hint={R.s.foncier === "micro" ? `micro-foncier : ${eur(R.loyers)} − 30 % d'abattement` : `réel : ${eur(R.loyers)} − intérêts ${eur(R.interets)} − charges ${eur(R.s.chargesFoncieres + R.s.travaux)}`} />
            <StatRow label="Versements PER déductibles" value={"− " + eur(R.perVerse)} hint={`plafond épargne retraite ${eur(R.plafondPer)}`} />
            <StatRow label="Revenu net imposable" value={eur(R.rni)} hint={`${R.parts.toLocaleString("fr-FR")} parts fiscales`} />
            <StatRow label="Impôt au barème" value={eur(R.ir)} hint={`${eur(R.rni / R.parts)} par part`} />
            {R.qfCapped > 0
              ? <StatRow label="Plafonnement du quotient familial" value={"+ " + eur(R.qfCapped)} hint={`avantage limité à ${eur(R.capQf)}`} />
              : <StatRow label="Avantage des personnes à charge" value={"− " + eur(R.avantage)} hint={`plafond disponible ${eur(R.capQf)} — marge de ${eur(R.capQf - R.avantage)}`} />}
            {R.decote > 0 && <StatRow label="Décote" value={"− " + eur(R.decote)} hint="appliquée automatiquement aux impôts modestes" />}
            <StatRow label="Réductions et crédits d'impôt" value={"− " + eur(R.reductions)} hint="dons, services à domicile, garde d'enfants" />
            <StatRow label={<b>Impôt sur le revenu net</b>} value={<b>{eur(R.irNet)}</b>} hint={`soit ${pc(R.tauxMoyen)} de taux moyen`} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Autres prélèvements</span></div>
          <div className="stat-list">
            <StatRow label="Prélèvements sociaux sur les loyers" value={eur(R.psFoncier)} hint={`17,2 % de ${eur(Math.max(0, R.foncier))}`} />
            <StatRow label="Prélèvement forfaitaire sur les placements" value={eur(R.psCapitaux + R.irCapitaux)} hint={`30 % de ${eur(R.s.dividendes + R.s.interets)} (12,8 % d'IR + 17,2 % de sociaux)`} />
            <StatRow label="Taxe foncière estimée" value={eur(extra.taxeFonciere)} hint={`≈ 0,8 % de la valeur des ${nProps} bien${nProps > 1 ? "s" : ""} — à remplacer par les avis réels`} />
            <StatRow label="Base IFI (patrimoine immobilier net)" value={eur(extra.ifiBase)} hint={extra.ifiBase < P.ifiThreshold ? `sous le seuil de ${eur(P.ifiThreshold)} : non redevable` : "au-delà du seuil : déclaration IFI requise"} />
            <StatRow label="Coût fiscal total du foyer" value={eur(R.totalPrel + extra.taxeFonciere)} hint={`${pc(R.revenusReels ? ((R.totalPrel + extra.taxeFonciere) / R.revenusReels) * 100 : 0)} des revenus encaissés`} />
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Pistes d&apos;optimisation</span>
          <span className="card-sub">Potentiel cumulé estimé : {eur(advice.totalGain)}</span>
        </div>
        <div>
          {advice.list.map((a, i) => (
            <AdviceRow key={i} a={a} gainTag={a.gain ? <span className="gain-tag num private">− {eur(a.gain)} d&apos;impôt</span> : null} />
          ))}
        </div>
        <Disclaimer />
      </div>

      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Scénarios comparés</span><span className="card-sub">Effet de chaque levier sur l&apos;impôt du foyer</span></div>
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Scénario</th><th className="r">Revenu imposable</th><th className="r">Impôt</th><th className="r">Prélèvements totaux</th><th className="r">Écart</th></tr></thead>
            <tbody>
              {scen.map((sc, i) => (
                <tr key={sc.label} className={i === 0 ? "cur" : undefined}>
                  <td>{sc.label}</td>
                  <td className="r num private">{eur(sc.result.rni)}</td>
                  <td className="r num private">{eur(sc.result.irNet)}</td>
                  <td className="r num private">{eur(sc.result.totalPrel)}</td>
                  <td className={`r num ${sc.diff < -1 ? "pos" : sc.diff > 1 ? "neg" : ""}`}>
                    {i === 0 || Math.abs(sc.diff) < 1 ? "—" : (sc.diff < 0 ? "− " : "+ ") + eur(sc.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inv-note">
          Calculs au barème {sit.year} (tranches {eur(BRACKETS[0][0])} / {eur(BRACKETS[1][0])} / {eur(BRACKETS[2][0])}), hors situations particulières. À confronter à votre avis d&apos;imposition.
        </div>
      </div>

      <div className="grid-7-5">
        <div className="card">
          <div className="card-header"><span className="card-title">Barème par tranche</span></div>
          <div className="table-wrap">
            <table className="dtable">
              <thead><tr><th>Tranche (par part)</th><th className="r">Taux</th><th className="r">Base imposée</th><th className="r">Impôt / part</th><th className="r">Impôt foyer</th></tr></thead>
              <tbody>
                {R.bar.detail.map((b) => (
                  <tr key={b.from}>
                    <td>{eur(b.from)} → {b.to === Infinity ? "au-delà" : eur(b.to)}</td>
                    <td className="r num">{pc(b.rate * 100, 0)}</td>
                    <td className="r num private">{eur(b.base)}</td>
                    <td className="r num private">{eur(b.tax)}</td>
                    <td className="r num private">{eur(b.tax * R.parts)}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td>Total</td>
                  <td className="r num">TMI {pc(R.tmi, 0)}</td>
                  <td className="r num private">{eur(R.rni / R.parts)}</td>
                  <td className="r num private">{eur(R.ir / R.parts)}</td>
                  <td className="r num private">{eur(R.ir)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Composition des revenus</span></div>
          <div className="stat-list">
            <StatRow label="Salaires imposables" value={eur(R.salNet)} hint={`${rbgPct(R.salNet)} du revenu brut global`} />
            <StatRow label="Revenus fonciers imposables" value={eur(Math.max(0, R.foncier))} hint={`${rbgPct(Math.max(0, R.foncier))} du revenu brut global`} />
            <StatRow label="Dividendes & intérêts" value={eur(R.s.dividendes + R.s.interets)} hint="imposés à part, au prélèvement forfaitaire de 30 %" />
            <StatRow label="Plus-values latentes non imposées" value={eurS(S.pv).replace(/^\+ /, "")} hint="l'impôt ne se déclenche qu'à la cession" />
            <StatRow label="Revenus exonérés" value={eur(extra.exonere)} hint="intérêts des livrets réglementés (estimation)" />
          </div>
        </div>
      </div>

      {open && <SituationModal situation={sit} onClose={() => setOpen(false)} onSave={saveSituation} />}
    </div>
  )
}
