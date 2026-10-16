"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CURRENCIES, currencySym, exposure, fmtCurrency, fxRate, getBaseCurrency, baseSym, type FxSource, type FxTable } from "@/lib/finance/fx"
import { eur, pc } from "@/lib/finance/format"
import { FxModal, FX_DEMO_TS } from "./FxModal"
import { HouseholdCard } from "./HouseholdCard"
import { AccountGroups } from "./AccountGroups"
import { MemberModal } from "./MemberModal"
import { AccountModal } from "./AccountModal"
import { ChildSpendingReport } from "./ChildSpendingReport"
import type { EnrichedAccount, Member, Bank } from "./types"
import type { Goal } from "@/db/schema"

interface ChildSpending {
  totalCents: number
  transactions: { id: string; name: string; amountCents: number; date: string }[]
}

interface Props {
  household: { name: string; householdId: string }
  members: Member[]
  banks: Bank[]
  accounts: EnrichedAccount[]
  childGoals?: Record<string, Goal[]>
  childSpending?: Record<string, ChildSpending>
  fx: { rates: FxTable; source: FxSource; ts: string; positions: { value: number; qty: number; price: number; cur: string }[] }
}

export function AccountsClient({ household, members, banks, accounts, childGoals = {}, childSpending = {}, fx }: Props) {
  const router = useRouter()
  const [fxOpen, setFxOpen] = useState(false)
  const [memberList, setMemberList] = useState<Member[]>(members)
  const [accountList, setAccountList] = useState<EnrichedAccount[]>(accounts)
  const [bankList, setBankList] = useState<Bank[]>(banks)
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editAccount, setEditAccount] = useState<EnrichedAccount | null>(null)
  const [childViewId, setChildViewId] = useState<string | null>(null)

  function handleMemberSaved(member: Member) {
    setMemberList((prev) => [member, ...prev])
    setShowMemberModal(false)
  }

  function handleAccountSaved(saved: Omit<EnrichedAccount, "balanceBaseCents">) {
    const account: EnrichedAccount = { ...saved, balanceBaseCents: Math.round(saved.balanceCents * fxRate(saved.currency || getBaseCurrency(), fx.rates)) }
    setAccountList((prev) => {
      const idx = prev.findIndex((a) => a.id === account.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = account
        return next
      }
      return [account, ...prev]
    })
    setShowAccountModal(false)
    setEditAccount(null)
  }

  function handleAccountDeleted(id: string) {
    setAccountList((prev) => prev.filter((a) => a.id !== id))
    setEditAccount(null)
  }

  function handleBankCreated(bank: Bank) {
    setBankList((prev) => [...prev, bank])
  }

  const uniqueBankIds = new Set(accountList.map((a) => a.bankId).filter(Boolean))

  const base = getBaseCurrency()
  const expo = exposure(
    accountList.map((a) => ({ cur: a.currency || base, native: (a.balanceCents ?? 0) / 100, balance: ((a.balanceCents ?? 0) / 100) * fxRate(a.currency || base, fx.rates) })),
    fx.positions,
  )
  const foreign = expo.rows.filter((r) => r.cur !== base)
  const foreignEur = foreign.reduce((s, r) => s + r.eur, 0)
  const fxSourceLabel = fx.source === "api" ? "Fournisseur externe" : fx.source === "manual" ? "Taux manuels" : "Taux de référence"

  const childViewMember = childViewId ? memberList.find((m) => m.id === childViewId) : null
  const childMembers = memberList.filter((m) => m.isChild)

  return (
    <>
      <div className="page-comptes">
        <div className="page-header">
          <div>
            <h1 className="page-title">Comptes &amp; foyer</h1>
            <div className="page-sub">Personnes, comptes bancaires et imports</div>
          </div>
          {!childViewId && (
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="btn btn-ghost btn-sm" href="/transactions?import=1"><i className="ti ti-upload" /> Importer un CSV</Link>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowAccountModal(true)}>
                <i className="ti ti-plus" /> Nouveau compte
              </button>
            </div>
          )}
        </div>

        {childViewId && childViewMember && (
          <div className="child-view-banner">
            <i className="ti ti-eye" />
            <span>Vous voyez le foyer comme <strong>{childViewMember.short ?? childViewMember.name.split(" ")[0]}</strong></span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setChildViewId(null)}
            >
              Quitter cette vue
            </button>
          </div>
        )}

        {!childViewId && (
          <HouseholdCard
            householdName={household.name}
            members={memberList}
            accounts={accountList}
            banksCount={uniqueBankIds.size}
            onAddMember={() => setShowMemberModal(true)}
            childGoals={childGoals}
            onChildView={(id) => setChildViewId(id)}
          />
        )}

        {/* Devises — hidden in child view */}
        {!childViewId && (
          <div className="card mb-16" id="fx-card">
            <div className="card-header">
              <span className="card-title">Devises</span>
              <span className="card-sub">{fxSourceLabel} · {fx.ts || FX_DEMO_TS}</span>
            </div>
            <div className="fx-top">
              <div><div className="inv-lbl">Contre-valeur totale</div><div className="fx-val num private">{eur(expo.total)}</div><div className="metric-sub neutral">comptes {eur(expo.cash)} + placements {eur(expo.total - expo.cash)}</div></div>
              <div><div className="inv-lbl">Exposition hors {base}</div><div className="fx-val num private">{eur(foreignEur)}</div>
                <div className={`metric-sub ${expo.total && foreignEur / expo.total > 0.3 ? "down" : "neutral"}`}>{pc(expo.total ? (foreignEur / expo.total) * 100 : 0)} du total · {foreign.length} devise{foreign.length > 1 ? "s" : ""}</div></div>
              <div><div className="inv-lbl">Impact d&apos;un {base} +5 %</div><div className="fx-val num private">− {eur(foreignEur * 0.05)}</div><div className="metric-sub neutral">et + {eur(foreignEur * 0.05)} si le {base} baisse de 5 %</div></div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setFxOpen(true)}><i className="ti ti-currency-euro" /> Taux &amp; devises</button>
              </div>
            </div>
            <div className="fx-rows">
              {expo.rows.map((r) => (
                <div className="fx-row" key={r.cur}>
                  <span className="fx-cur">{r.cur} <span className="fx-sym">{currencySym(r.cur)}</span></span>
                  <span className="fx-name">{CURRENCIES[r.cur]?.name ?? r.cur}</span>
                  <div className="cat-track"><div className="cat-fill" style={{ width: `${r.w}%`, background: r.cur === base ? "#1D9E75" : "#EF9F27" }} /></div>
                  <span className="fx-nat num private">{fmtCurrency(r.nat, r.cur)}</span>
                  <span className="fx-rate num">{r.cur === base ? "—" : `1 ${r.cur} = ${fxRate(r.cur, fx.rates).toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${baseSym()}`}</span>
                  <span className="fx-eur num private">{eur(r.eur)}</span>
                  <span className="fx-w num">{pc(r.w, 0)}</span>
                </div>
              ))}
            </div>
            <div className="inv-note">Les opérations importées sur un compte en devise sont converties en {base} au taux du jour de l&apos;import ; les soldes restent affichés dans leur devise d&apos;origine.</div>
          </div>
        )}

        {/* Child spending report — only shown to parents */}
        {!childViewId && childMembers.length > 0 && (
          <ChildSpendingReport
            children={childMembers}
            spending={childSpending}
          />
        )}

        <AccountGroups
          members={memberList}
          banks={bankList}
          accounts={accountList}
          ownerFilter={ownerFilter}
          onOwnerFilter={setOwnerFilter}
          onAddAccount={() => setShowAccountModal(true)}
          onEditAccount={(a) => setEditAccount(a)}
          childViewId={childViewId}
        />
      </div>

      {fxOpen && <FxModal rates={fx.rates} source={fx.source} ts={fx.ts} onClose={() => setFxOpen(false)} onSaved={() => { setFxOpen(false); router.refresh() }} />}

      {showMemberModal && (
        <MemberModal
          onClose={() => setShowMemberModal(false)}
          onSaved={handleMemberSaved}
        />
      )}

      {showAccountModal && (
        <AccountModal
          members={memberList}
          banks={bankList}
          onClose={() => setShowAccountModal(false)}
          onSaved={handleAccountSaved}
          onBankCreated={handleBankCreated}
        />
      )}

      {editAccount && (
        <AccountModal
          members={memberList}
          banks={bankList}
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onSaved={handleAccountSaved}
          onDeleted={handleAccountDeleted}
          onBankCreated={handleBankCreated}
        />
      )}
    </>
  )
}
