"use client"
import { formatCents } from "@/lib/money"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { Card } from "@/components/ui/Card"
import type { Member } from "./types"

interface SpendingTx {
  id: string
  name: string
  amountCents: number
  date: string
}

interface ChildSpending {
  totalCents: number
  transactions: SpendingTx[]
}

interface Props {
  children: Member[]
  spending: Record<string, ChildSpending>
}

export function ChildSpendingReport({ children, spending }: Props) {
  const { private: isPrivate } = usePrivacy()

  const childrenWithSpending = children.filter(
    (c) => spending[c.id] && (spending[c.id].totalCents !== 0 || spending[c.id].transactions.length > 0)
  )

  if (childrenWithSpending.length === 0) return null

  return (
    <Card>
      <div className="card-header">
        <span className="card-title">Dépenses enfants ce mois</span>
      </div>
      <div className="child-spending-list">
        {childrenWithSpending.map((child) => {
          const s = spending[child.id]
          return (
            <div key={child.id} className="child-spending-block">
              <div className="child-spending-head">
                <span
                  className="mini-av"
                  style={{
                    background: `${child.colorHex}22`,
                    color: child.colorHex,
                    borderColor: `${child.colorHex}55`,
                  }}
                >
                  {child.short[0]}
                </span>
                <span className="child-spending-name">{child.short ?? child.name.split(" ")[0]}</span>
                <span className={`child-spending-total${isPrivate ? " private" : ""}`}>
                  {formatCents(Math.abs(s.totalCents))}
                </span>
              </div>
              {s.transactions.length > 0 && (
                <div className="child-spending-txs">
                  {s.transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="child-tx-row">
                      <span className="child-tx-name">{tx.name}</span>
                      <span className="child-tx-date">{tx.date.slice(5).replace("-", "/")}</span>
                      <span className={`child-tx-amount${isPrivate ? " private" : ""}`}>
                        {formatCents(tx.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
