"use client"
import { useNav } from "@/contexts/NavContext"

// Barre du haut en mobile : bouton de menu + marque (masquée sur grand écran).
export function MobileBar() {
  const { open, toggle } = useNav()
  return (
    <div className="mobile-bar">
      <button type="button" className="icon-btn" onClick={toggle} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open}>
        <i aria-hidden="true" className={`ti ${open ? "ti-x" : "ti-menu-2"}`} />
      </button>
      <div className="brand">
        <div className="brand-mark">L</div>
        <div className="brand-name">Lǐcái</div>
      </div>
    </div>
  )
}
