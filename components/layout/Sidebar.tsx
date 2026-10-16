"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"
import { useSearch } from "@/contexts/SearchContext"
import { useAssistant } from "@/contexts/AssistantContext"

const NAV = [
  { section: "Pilotage" },
  { href: "/dashboard",    icon: "ti-layout-dashboard",       label: "Dashboard" },
  { href: "/alertes",      icon: "ti-bell",                   label: "Alertes" },
  { href: "/previsions",   icon: "ti-chart-arrows-vertical",  label: "Prévisions" },
  { href: "/objectifs",    icon: "ti-target",                 label: "Objectifs" },
  { href: "/trajectoire",  icon: "ti-mountain",               label: "Trajectoire" },
  { section: "Au quotidien" },
  { href: "/transactions", icon: "ti-arrows-exchange",        label: "Transactions" },
  { href: "/budget",       icon: "ti-chart-pie",              label: "Budget" },
  { href: "/recurrent",    icon: "ti-repeat",                 label: "Récurrent" },
  { href: "/partage",      icon: "ti-scale-outline",          label: "Répartition" },
  { section: "Patrimoine" },
  { href: "/comptes",      icon: "ti-building-bank",          label: "Comptes & foyer" },
  { href: "/patrimoine",   icon: "ti-home-stats",             label: "Patrimoine" },
  { href: "/credits",      icon: "ti-percentage",             label: "Crédits" },
  { href: "/placements",   icon: "ti-chart-candle",           label: "Placements" },
  { section: "Fiscalité & transmission" },
  { href: "/impots",       icon: "ti-receipt-tax",            label: "Impôts" },
  { href: "/prevoyance",   icon: "ti-shield-half",            label: "Prévoyance" },
]

export function Sidebar() {
  const path = usePathname()
  const { data: session } = useSession()
  const { private: priv, toggle: togglePrivacy } = usePrivacy()
  const { theme, toggle: toggleTheme } = useTheme()
  const { openSearch } = useSearch()
  const { openAssistant } = useAssistant()
  const [alertCount, setAlertCount] = useState(0)
  useEffect(() => {
    let live = true
    fetch("/api/alerts/summary").then((r) => (r.ok ? r.json() : null)).then((j: { data?: { count: number } } | null) => { if (live && j?.data) setAlertCount(j.data.count) }).catch(() => {})
    return () => { live = false }
  }, [path])
  const userName = session?.user?.name ?? session?.user?.email ?? "Mon compte"
  const userInitial = (session?.user?.name ?? session?.user?.email ?? "?")[0].toUpperCase()

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
            {item.href === "/alertes" && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
          </Link>
        )
      )}

      <div className="nav-spacer" />

      <div className="sidebar-tools">
        <button className="sidebar-tool accent" onClick={openAssistant}>
          <i className="ti ti-sparkles" />
          <span>Assistant IA</span>
        </button>
        <button className="sidebar-tool" onClick={openSearch}>
          <i className="ti ti-search" />
          <span>Rechercher</span>
          <kbd className="sidebar-kbd">⌘K</kbd>
        </button>
        <button className="sidebar-tool" onClick={togglePrivacy}>
          <i className={`ti ${priv ? "ti-eye-off" : "ti-eye"}`} />
          <span>{priv ? "Afficher les chiffres" : "Cacher les chiffres"}</span>
        </button>
        <button className="sidebar-tool" onClick={toggleTheme}>
          <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} />
          <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
        </button>
      </div>

      <div className="sidebar-divider" />

      <Link href="/parametres" className="user-row">
        <div className="avatar">{userInitial}</div>
        <div className="user-meta">
          <div className="user-name">{userName}</div>
          <div className="user-plan">Paramètres du compte</div>
        </div>
        <i className="ti ti-settings user-row-ic" />
      </Link>
    </aside>
  )
}
