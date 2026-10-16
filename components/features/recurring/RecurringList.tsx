"use client"
import { Chip } from "@/components/ui/Chip"
import { formatCents } from "@/lib/money"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"
import { usePrivacy } from "@/contexts/PrivacyContext"
import type { Recurring, Account, Category, Bank } from "@/db/schema"

type KindFilter = "all" | "charge" | "subscription" | "insurance" | "saving" | "paused"

interface Props {
  items: Recurring[]
  accounts: Account[]
  categories: Category[]
  banks: Bank[]
  filter: KindFilter
  onFilterChange: (f: KindFilter) => void
  onEdit: (item: Recurring) => void
  onUpdated: (item: Recurring) => void
}

const KIND_COLORS: Record<string, string> = {
  charge: "#D85A30",
  subscription: "#EF9F27",
  insurance: "#378ADD",
  saving: "#1D9E75",
}

const KIND_ICONS: Record<string, string> = {
  charge: "ti-calendar-repeat",
  subscription: "ti-device-tv",
  insurance: "ti-shield-check",
  saving: "ti-pig-money",
}

const KIND_LABELS: Record<string, string> = {
  charge: "Charge",
  subscription: "Abonnement",
  insurance: "Assurance",
  saving: "Épargne",
}

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  annual: "Annuel",
}

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "charge", label: "Charges" },
  { value: "subscription", label: "Abonnements" },
  { value: "insurance", label: "Assurances" },
  { value: "saving", label: "Épargne" },
  { value: "paused", label: "En pause" },
]

export function RecurringList({
  items,
  accounts,
  categories,
  banks,
  filter,
  onFilterChange,
  onEdit,
  onUpdated,
}: Props) {
  const { private: priv } = usePrivacy()

  const filtered = items.filter((r) => {
    if (filter === "paused") return !r.active
    if (filter === "all") return true
    return r.kind === filter
  })

  const activeItems = items.filter((r) => r.active)

  const chargesMonthly = activeItems
    .filter((r) => r.kind !== "saving")
    .reduce((s, r) => s + frequencyToMonthlyCents(r.amountCents, r.frequency), 0)

  const subscriptionsMonthly = activeItems
    .filter((r) => r.kind === "subscription")
    .reduce((s, r) => s + frequencyToMonthlyCents(r.amountCents, r.frequency), 0)

  const savingMonthly = activeItems
    .filter((r) => r.kind === "saving")
    .reduce((s, r) => s + frequencyToMonthlyCents(r.amountCents, r.frequency), 0)

  return (
    <div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Charges fixes / mois</span>
            <span className="metric-ic" style={{ background: "#D85A3020" }}>
              <i className="ti ti-calendar-repeat" style={{ color: "#D85A30" }} />
            </span>
          </div>
          <div className={`metric-value ${priv ? "private" : ""}`}>
            {formatCents(chargesMonthly)}
          </div>
          <div className="metric-sub">hors épargne</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Avec les crédits</span>
            <span className="metric-ic" style={{ background: "#6366F120" }}>
              <i className="ti ti-credit-card" style={{ color: "#6366F1" }} />
            </span>
          </div>
          <div className={`metric-value ${priv ? "private" : ""}`}>
            {formatCents(chargesMonthly)}
          </div>
          <div className="metric-sub">+0 € de crédits</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Abonnements</span>
            <span className="metric-ic" style={{ background: "#EF9F2720" }}>
              <i className="ti ti-device-tv" style={{ color: "#EF9F27" }} />
            </span>
          </div>
          <div className={`metric-value ${priv ? "private" : ""}`}>
            {formatCents(subscriptionsMonthly)}
          </div>
          <div className="metric-sub">/ mois</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Épargne automatique</span>
            <span className="metric-ic" style={{ background: "#1D9E7520" }}>
              <i className="ti ti-pig-money" style={{ color: "#1D9E75" }} />
            </span>
          </div>
          <div className={`metric-value ${priv ? "private" : ""}`}>
            {formatCents(savingMonthly)}
          </div>
          <div className="metric-sub">/ mois</div>
        </div>
      </div>

      <div className="rec-chips-row">
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => onFilterChange(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="rec-rows">
        {filtered.length === 0 && (
          <p className="text-secondary">Aucun élément.</p>
        )}
        {filtered.map((r) => {
          const account = accounts.find((a) => a.id === r.accountId)
          const category = categories.find((c) => c.id === r.categoryId)
          const bank = account ? banks.find((b) => b.id === account.bankId) : null
          const monthly = frequencyToMonthlyCents(r.amountCents, r.frequency)
          const kindColor = KIND_COLORS[r.kind] ?? "var(--fg-secondary)"
          const kindIcon = KIND_ICONS[r.kind] ?? "ti-refresh"

          const subParts: string[] = [KIND_LABELS[r.kind] ?? r.kind]
          if (category) subParts.push(category.label)
          if (bank) subParts.push(bank.name)
          if (account) subParts.push(account.name)

          return (
            <div key={r.id} className={`rec-row ${!r.active ? "paused" : ""}`}>
              <div
                className="rec-ic"
                style={{ background: `${kindColor}20`, color: kindColor }}
              >
                <i className={`ti ${kindIcon}`} />
              </div>

              <div className="rec-main">
                <div className="rec-name">
                  {r.name}
                  {!r.active && <span className="rec-pause-tag">En pause</span>}
                </div>
                <div className="rec-sub">{subParts.join(" · ")}</div>
              </div>

              <div className="rec-freq-col">
                <span className="rec-freq-tag">{FREQ_LABELS[r.frequency] ?? r.frequency}</span>
                <span className="rec-day">
                  le {r.nextDate.slice(8, 10)}
                </span>
              </div>

              <div className="rec-amt">
                <span className={`rec-amt-main ${priv ? "private" : ""}`}>
                  {formatCents(r.amountCents)}
                </span>
                <span className={`rec-amt-sub ${priv ? "private" : ""}`}>
                  {formatCents(monthly)}/mois
                </span>
              </div>

              <div className="rec-owners-wrap">
                <button
                  className="rec-act"
                  title={r.active ? "Mettre en pause" : "Réactiver"}
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/recurring/${r.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ active: !r.active }),
                    })
                    if (res.ok) {
                      const json = (await res.json()) as { data: Recurring }
                      onUpdated(json.data)
                    }
                  }}
                >
                  <i className={`ti ${r.active ? "ti-player-pause" : "ti-player-play"}`} />
                </button>
                <button
                  className="rec-act"
                  title="Modifier"
                  type="button"
                  onClick={() => onEdit(r)}
                >
                  <i className="ti ti-pencil" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
