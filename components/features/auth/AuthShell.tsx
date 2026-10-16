import type { ReactNode } from "react"

interface Props {
  title: string
  text: string
  items: { icon: string; label: string }[]
  children: ReactNode
}

export function AuthShell({ title, text, items, children }: Props) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <div className="brand-name">Lǐcái</div>
            <div className="brand-sub">Finances personnelles</div>
          </div>
        </div>
        <div className="aside-title">{title}</div>
        <div className="aside-text">{text}</div>
        <div className="aside-list">
          {items.map((it) => (
            <div className="aside-item" key={it.label}>
              <i className={`ti ${it.icon}`} /> <span>{it.label}</span>
            </div>
          ))}
        </div>
        <div className="aside-foot">
          Lǐcái est un outil de suivi. Aucune recommandation d&apos;investissement, aucun mandat de gestion.<br />
          <a href="/legal/mentions-legales.html">Mentions légales</a> · <a href="/legal/conditions.html">Conditions d&apos;utilisation</a>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          {children}
          <div className="disclaimer">
            <i className="ti ti-alert-triangle" />
            <span>
              <b>Information, pas conseil.</b> Lǐcái agrège et analyse vos données à titre informatif. Ni conseil en
              investissement, ni recommandation personnalisée, ni conseil fiscal ou juridique. Tout placement comporte un
              risque de perte en capital ; vous restez seul responsable de vos décisions.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
