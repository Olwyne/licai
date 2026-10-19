"use client"
import { formatCents } from "@/lib/money"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { Card } from "@/components/ui/Card"
import type { EnrichedAccount, Member } from "./types"
import type { Goal } from "@/db/schema"

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

function calcAge(birthYear: number | null | undefined): number | null {
  if (!birthYear) return null
  return new Date().getFullYear() - birthYear
}

interface Props {
  householdName: string
  members: Member[]
  accounts: EnrichedAccount[]
  banksCount: number
  onAddMember: () => void
  childGoals?: Record<string, Goal[]>
  onChildView?: (memberId: string) => void
}

export function HouseholdCard({
  householdName,
  members,
  accounts,
  banksCount,
  onAddMember,
  childGoals = {},
  onChildView,
}: Props) {
  const { private: isPrivate } = usePrivacy()

  const totalBalance = accounts.reduce((sum, a) => sum + a.balanceBaseCents, 0)

  const memberStats = members.map((m) => {
    const memberAccounts = accounts.filter((a) => a.ownerIds.includes(m.id))
    const memberBalance = memberAccounts.reduce((sum, a) => sum + a.balanceBaseCents, 0)
    const age = calcAge(m.birthYear)
    const goals = childGoals[m.id] ?? []
    return { ...m, accountCount: memberAccounts.length, balance: memberBalance, age, goals }
  })

  return (
    <Card>
      <div className="hh-head">
        <div className="hh-mark"><i aria-hidden="true" className="ti ti-home-heart" /></div>
        <div>
          <div className="hh-name">{householdName}</div>
          <div className="hh-sub">
            {members.length} personne{members.length > 1 ? "s" : ""} ·{" "}
            {accounts.length} compte{accounts.length > 1 ? "s" : ""} ·{" "}
            {banksCount} banque{banksCount > 1 ? "s" : ""}
          </div>
        </div>
        <div className="hh-total">
          <div className="hh-total-lbl">Trésorerie du foyer</div>
          <div className={`hh-total-val${isPrivate ? " private" : ""}`}>
            {formatCents(totalBalance)}
          </div>
          <div className="hh-total-lbl">hors placements et immobilier</div>
        </div>
      </div>
      <div className="member-grid">
        {memberStats.map((m) => (
          <div key={m.id} className={`member-card${m.isChild ? " member-card--child" : ""}`}>
            <span
              className="mini-av"
              style={{
                background: `${m.colorHex}22`,
                color: m.colorHex,
                borderColor: `${m.colorHex}55`,
              }}
            >
              {initials(m.name)}
            </span>
            <div className="member-info">
              <div className="member-name">
                {m.name}
                {m.age !== null && <span className="member-age"> · {m.age} ans</span>}
              </div>
              <div className="member-role">{m.role}</div>
              {m.isChild && (
                <span className="badge-enfant">Enfant (lecture)</span>
              )}
              {m.isChild && m.allowanceCents > 0 && (
                <div className="allowance-line">
                  <i aria-hidden="true" className="ti ti-coins" /> Argent de poche : {formatCents(m.allowanceCents)}/mois
                </div>
              )}
              {m.isChild && m.goals.length > 0 && (
                <div className="goal-mini-list">
                  {m.goals.slice(0, 2).map((g) => {
                    const pct = Math.min(100, Math.round((g.currentCents / g.targetCents) * 100))
                    return (
                      <div key={g.id} className="goal-mini">
                        <div className="goal-mini-header">
                          <span>{g.emoji} {g.name}</span>
                          <span className="goal-mini-pct">{pct}%</span>
                        </div>
                        <div className="goal-mini-track">
                          <div
                            className="goal-mini-fill"
                            style={{ width: `${pct}%`, background: g.colorHex }}
                          />
                        </div>
                        <div className="goal-mini-amounts">
                          <span className={isPrivate ? "private" : ""}>{formatCents(g.currentCents)}</span>
                          <span className="goal-mini-target">/ {formatCents(g.targetCents)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="member-nums">
              <div className={`member-sum${isPrivate ? " private" : ""}`}>
                {formatCents(m.balance)}
              </div>
              <div className="member-accs">
                {m.accountCount} compte{m.accountCount > 1 ? "s" : ""}
              </div>
              {m.isChild && onChildView && (
                <button
                  type="button"
                  className="btn-child-view"
                  onClick={() => onChildView(m.id)}
                  title={`Voir le foyer comme ${m.short ?? m.name.split(" ")[0]}`}
                >
                  <i aria-hidden="true" className="ti ti-eye" /> Vue {m.short ?? m.name.split(" ")[0]}
                </button>
              )}
            </div>
          </div>
        ))}
        <div
          className="member-card add"
          onClick={onAddMember}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onAddMember()}
        >
          <span>+</span>
          <span>Ajouter une personne</span>
        </div>
      </div>
    </Card>
  )
}
