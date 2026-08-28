"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"
import { signOut } from "next-auth/react"

const NAV = [
  { section: "Pilotage" },
  { href: "/dashboard",    icon: "ti-layout-dashboard",  label: "Dashboard" },
  { href: "/alertes",      icon: "ti-bell",              label: "Alertes" },
  { href: "/previsions",  icon: "ti-chart-arrows-vertical", label: "Prévisions" },
  { href: "/trajectoire", icon: "ti-trending-up",        label: "Trajectoire" },
  { href: "/placements",  icon: "ti-chart-pie",         label: "Placements" },
  { href: "/impots",      icon: "ti-receipt-tax",       label: "Impôts" },
  { href: "/objectifs",   icon: "ti-target",            label: "Objectifs" },
  { section: "Au quotidien" },
  { href: "/transactions", icon: "ti-arrows-exchange",   label: "Transactions" },
  { href: "/budget",       icon: "ti-chart-pie",         label: "Budget" },
  { href: "/recurrent",    icon: "ti-repeat",            label: "Récurrent" },
  { href: "/partage",      icon: "ti-scale-outline",     label: "Répartition" },
  { section: "Patrimoine" },
  { href: "/patrimoine",   icon: "ti-building-estate",   label: "Patrimoine" },
  { href: "/comptes",      icon: "ti-building-bank",     label: "Comptes & foyer" },
  { section: "Réglages" },
  { href: "/parametres",   icon: "ti-settings",          label: "Paramètres" },
]

export function Sidebar() {
  const path = usePathname()
  const { private: priv, toggle: togglePrivacy } = usePrivacy()
  const { theme, toggle: toggleTheme } = useTheme()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">L</div>
        <div>
          <div className="brand-name">Lǐcái</div>
          <div className="brand-sub">Finances personnelles</div>
        </div>
      </div>

      {NAV.map((item, i) =>
        "section" in item ? (
          <div key={i} className="nav-section">{item.section}</div>
        ) : (
          <Link key={item.href} href={item.href}
            className={`nav-item ${path === item.href ? "active" : ""}`}>
            <i className={`ti ${item.icon}`} />
            {item.label}
          </Link>
        )
      )}

      <div className="nav-spacer" />
      <div className="sidebar-tools">
        <button className="sidebar-tool" onClick={togglePrivacy}>
          <i className={`ti ${priv ? "ti-eye-off" : "ti-eye"}`} />
          <span>{priv ? "Afficher les chiffres" : "Cacher les chiffres"}</span>
        </button>
        <button className="sidebar-tool" onClick={toggleTheme}>
          <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} />
          <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
        </button>
        <button className="sidebar-tool" onClick={() => signOut({ callbackUrl: "/login" })}>
          <i className="ti ti-logout" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
