"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"

interface Prefs {
  displayName: string
  roundAmounts: boolean
  alertBudget: boolean
  alertEcheance: boolean
  alertReport: boolean
  firstDay: "1" | "paie"
  currency: string
}

const PREF_KEY = "licai-prefs"

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) as Partial<Prefs> }
  } catch {}
  return defaultPrefs()
}

function defaultPrefs(): Prefs {
  return {
    displayName: "",
    roundAmounts: false,
    alertBudget: true,
    alertEcheance: true,
    alertReport: false,
    firstDay: "1",
    currency: "EUR",
  }
}

function savePrefs(prefs: Prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch {}
}

// ─── Modal: Edit profile ───────────────────────────────────────────────────────
function ProfileModal({
  email,
  displayName,
  onSave,
  onClose,
}: {
  email: string
  displayName: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(displayName)

  function handleSave() {
    onSave(name.trim())
    onClose()
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Modifier le profil</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} readOnly />
          </div>
          <div className="field">
            <label>Nom affiché</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Votre prénom ou pseudo"
              autoFocus
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Change password ────────────────────────────────────────────────────
function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSave() {
    setError("")
    if (!current || !next || !confirm) { setError("Tous les champs sont requis."); return }
    if (next.length < 8) { setError("Le nouveau mot de passe doit contenir au moins 8 caractères."); return }
    if (next !== confirm) { setError("Les mots de passe ne correspondent pas."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? "Erreur inconnue"); return }
      setDone(true)
    } catch {
      setError("Erreur réseau. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Changer le mot de passe</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          {done ? (
            <p className="text-success">Mot de passe mis à jour avec succès.</p>
          ) : (
            <>
              {error && <p className="text-danger-sm">{error}</p>}
              <div className="field">
                <label>Mot de passe actuel</label>
                <input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Nouveau mot de passe</label>
                <input type="password" value={next} onChange={e => setNext(e.target.value)} />
              </div>
              <div className="field">
                <label>Confirmer le nouveau mot de passe</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          {done ? (
            <button className="btn btn-primary" onClick={onClose}>Fermer</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? "En cours…" : "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main client component ─────────────────────────────────────────────────────
export function ParametresClient() {
  const { data: session } = useSession()
  const { private: priv, toggle: togglePrivacy } = usePrivacy()
  const { theme, toggle: toggleTheme } = useTheme()

  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    setPrefs(loadPrefs())
  }, [])

  const updatePref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      savePrefs(next)
      return next
    })
  }, [])

  const email = session?.user?.email ?? ""
  const displayName = prefs.displayName || session?.user?.name || email.split("@")[0] || "Utilisateur"
  const initial = displayName.charAt(0).toUpperCase()

  const isDark = theme === "dark"

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Paramètres</div>
          <div className="page-sub">Personnalisez votre expérience Lǐcái</div>
        </div>
      </div>

      <div className="grid-2">
        {/* ── Card 1: Profil ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Profil</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowProfileModal(true)}>
              Modifier
            </button>
          </div>
          <div className="profile-head">
            <div className="avatar">{initial}</div>
            <div>
              <div className="profile-name">{displayName}</div>
              <div className="profile-mail">{email}</div>
            </div>
          </div>
          <div className="field-row mt-18">
            <div className="field">
              <label>Devise par défaut</label>
              <select value={prefs.currency} onChange={e => updatePref("currency", e.target.value)}>
                <option value="EUR">EUR — Euro</option>
                <option value="USD" disabled>USD — Dollar (bientôt)</option>
                <option value="GBP" disabled>GBP — Livre (bientôt)</option>
              </select>
            </div>
            <div className="field">
              <label>Premier jour du mois</label>
              <select
                value={prefs.firstDay}
                onChange={e => updatePref("firstDay", e.target.value as "1" | "paie")}
              >
                <option value="1">1er du mois</option>
                <option value="paie">Jour de paie</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Card 2: Affichage ───────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Affichage</div>
          </div>
          <div className="set-list">
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Thème sombre</div>
                <div className="set-desc">Interface en couleurs sombres</div>
              </div>
              <button
                className="switch"
                aria-pressed={isDark}
                onClick={toggleTheme}
              >
                <span />
              </button>
            </div>
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Cacher les chiffres</div>
                <div className="set-desc">Masque les montants sensibles</div>
              </div>
              <button
                className="switch"
                aria-pressed={priv}
                onClick={togglePrivacy}
              >
                <span />
              </button>
            </div>
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Arrondir les montants</div>
                <div className="set-desc">Sans décimales dans les listes</div>
              </div>
              <button
                className="switch"
                aria-pressed={prefs.roundAmounts}
                onClick={() => updatePref("roundAmounts", !prefs.roundAmounts)}
              >
                <span />
              </button>
            </div>
          </div>
        </div>

        {/* ── Card 3: Notifications ───────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Notifications</div>
          </div>
          <div className="set-list">
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Alerte dépassement de budget</div>
                <div className="set-desc">À 90 % du plafond</div>
              </div>
              <button
                className="switch"
                aria-pressed={prefs.alertBudget}
                onClick={() => updatePref("alertBudget", !prefs.alertBudget)}
              >
                <span />
              </button>
            </div>
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Échéances à venir</div>
                <div className="set-desc">3 jours avant un prélèvement</div>
              </div>
              <button
                className="switch"
                aria-pressed={prefs.alertEcheance}
                onClick={() => updatePref("alertEcheance", !prefs.alertEcheance)}
              >
                <span />
              </button>
            </div>
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Rapport mensuel</div>
                <div className="set-desc">Récap le 1er de chaque mois</div>
              </div>
              <button
                className="switch"
                aria-pressed={prefs.alertReport}
                onClick={() => updatePref("alertReport", !prefs.alertReport)}
              >
                <span />
              </button>
            </div>
          </div>
        </div>

        {/* ── Card 4: Compte ──────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Compte</div>
          </div>
          <button className="set-action" onClick={() => setShowPasswordModal(true)}>
            <i className="ti ti-key" />
            <div className="flex-1">
              <div className="set-name">Changer le mot de passe</div>
            </div>
            <i className="ti ti-chevron-right set-chev" />
          </button>
          <button
            className="set-action danger"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <i className="ti ti-logout" />
            <div className="flex-1">
              <div className="set-name">Se déconnecter</div>
            </div>
            <i className="ti ti-chevron-right set-chev" />
          </button>
        </div>
      </div>

      {showProfileModal && (
        <ProfileModal
          email={email}
          displayName={prefs.displayName}
          onSave={name => updatePref("displayName", name)}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showPasswordModal && (
        <PasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  )
}
