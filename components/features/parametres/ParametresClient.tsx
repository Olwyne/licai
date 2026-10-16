"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"
import Link from "next/link"
import { CURRENCIES } from "@/lib/finance/fx"
import { PROFILES, type ProfileKey } from "@/lib/finance/invest"
import { loadProfile, saveProfile } from "@/components/features/finance/quotes"

interface Prefs {
  displayName: string
  roundAmounts: boolean
  alertBudget: boolean
  alertEcheance: boolean
  alertReport: boolean
  alertSave: boolean
  anon: boolean
  firstDay: "1" | "paie"
  currency: string
}

const PREF_KEY = "licai-prefs"
const ASSET_LABEL: Record<string, string> = { actions: "actions", obligations: "obligations", euro: "fonds euro", immobilier: "immobilier", monetaire: "monétaire", crypto: "crypto" }

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
    alertSave: false,
    anon: false,
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

// ─── Card: Données & compte ───────────────────────────────────────────────────
function DataCard({ anon, onAnon, onPassword }: { anon: boolean; onAnon: () => void; onPassword: () => void }) {
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState("")
  const [acctDesc, setAcctDesc] = useState("—")

  useEffect(() => {
    fetch("/api/accounts").then((r) => (r.ok ? r.json() : null)).then((j: { data?: { bankId: string | null }[] } | null) => {
      if (!j?.data) return
      const banks = new Set(j.data.map((a) => a.bankId).filter(Boolean)).size
      setAcctDesc(`${j.data.length} compte${j.data.length > 1 ? "s" : ""} · ${banks} banque${banks > 1 ? "s" : ""}`)
    }).catch(() => {})
  }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg("")
    try {
      const data = JSON.parse(await file.text()) as { transactions?: unknown[] }
      setImportMsg(data.transactions ? `${data.transactions.length} transactions trouvées. Import non destructif à venir.` : "Fichier invalide — clé 'transactions' manquante.")
    } catch {
      setImportMsg("Erreur de lecture du fichier.")
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }

  const action = (icon: string, name: string, desc: React.ReactNode, onClick?: () => void, cls = "") => (
    <button className={`set-action ${cls}`} onClick={onClick} type="button">
      <i className={`ti ${icon}`} />
      <div className="flex-1"><div className="set-name">{name}</div><div className="set-desc">{desc}</div></div>
      <i className="ti ti-chevron-right set-chev" />
    </button>
  )

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Données &amp; compte</div></div>
      <div className="set-list">
        {action("ti-file-spreadsheet", "Exporter les transactions", "CSV compatible Excel et Google Sheets", () => { window.location.href = "/api/export/transactions" })}
        {action("ti-chart-candle", "Exporter le portefeuille", "Lignes, prix de revient et plus-values latentes", () => { window.location.href = "/api/export/portfolio" })}
        {action("ti-file-text", "Rapport patrimonial", "Synthèse imprimable ou PDF", () => { window.open("/rapport", "_blank") })}
        {action("ti-database-export", "Sauvegarde complète", "Fichier JSON de toutes les données du foyer", () => { window.location.href = "/api/export" })}
        <label className="set-action" style={{ cursor: "pointer" }}>
          <i className="ti ti-database-import" />
          <div className="flex-1"><div className="set-name">Importer une sauvegarde</div><div className="set-desc">{importing ? "Lecture…" : "Fichier JSON exporté depuis Lǐcái"}</div></div>
          <i className="ti ti-chevron-right set-chev" />
          <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
        </label>
        {importMsg && <p className="set-desc" style={{ padding: "8px 14px" }}>{importMsg}</p>}
        <div className="set-row">
          <div className="flex-1"><div className="set-name">Mode démo anonymisé</div><div className="set-desc">Masque noms, banques et libellés pour partager un écran</div></div>
          <button className="switch" aria-pressed={anon} onClick={onAnon} type="button"><span /></button>
        </div>
        <Link className="set-action" href="/comptes">
          <i className="ti ti-building-bank" />
          <div className="flex-1"><div className="set-name">Comptes bancaires</div><div className="set-desc">{acctDesc}</div></div>
          <i className="ti ti-chevron-right set-chev" />
        </Link>
        <a className="set-action" href="/legal/mentions-legales.html" target="_blank" rel="noreferrer">
          <i className="ti ti-gavel" />
          <div className="flex-1"><div className="set-name">Mentions légales</div><div className="set-desc">Statut, responsabilité, données personnelles</div></div>
          <i className="ti ti-chevron-right set-chev" />
        </a>
        <a className="set-action" href="/legal/conditions.html" target="_blank" rel="noreferrer">
          <i className="ti ti-file-text" />
          <div className="flex-1"><div className="set-name">Conditions d&apos;utilisation</div><div className="set-desc">Version 1.2 · 1er juin 2026</div></div>
          <i className="ti ti-chevron-right set-chev" />
        </a>
        {action("ti-key", "Changer le mot de passe", "Mise à jour de votre accès", onPassword)}
        <ResetDataButton />
        {action("ti-logout", "Se déconnecter", "Sur cet appareil uniquement", () => { void signOut({ callbackUrl: "/login" }) }, "danger")}
      </div>
    </div>
  )
}

// ─── ResetDataButton ─────────────────────────────────────────────────────────

function ResetDataButton() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleReset() {
    if (confirm.trim().toLowerCase() !== "supprimer") return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/reset-data", { method: "DELETE" })
      if (!res.ok) { setError("Erreur lors de la suppression."); return }
      setDone(true)
      setShowConfirm(false)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setConfirm("")
    setError("")
    setDone(false)
    setShowConfirm(true)
  }

  return (
    <>
      <button className="set-action danger" onClick={handleOpen}>
        <i className="ti ti-trash" />
        <div className="flex-1">
          <div className="set-name">Supprimer toutes les données</div>
          <div className="set-desc">Transactions, comptes, objectifs… Le compte utilisateur est conservé.</div>
        </div>
        <i className="ti ti-chevron-right set-chev" />
      </button>

      {done && (
        <p className="set-desc" style={{ padding: "8px 14px", color: "var(--primary)" }}>
          <i className="ti ti-circle-check" /> Toutes les données ont été supprimées.
        </p>
      )}

      {showConfirm && (
        <div className="modal-overlay open" onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ color: "var(--danger)" }}>
                <i className="ti ti-alert-triangle" /> Supprimer toutes les données
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConfirm(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
                Cette action est <strong>irréversible</strong>. Elle supprimera définitivement toutes les données du foyer :
                transactions, comptes, budgets, objectifs, crédits, placements, patrimoine, dépenses récurrentes.
              </p>
              <p style={{ fontSize: 13, marginBottom: 12, color: "var(--fg-muted)" }}>
                Ton compte utilisateur et ton accès sont conservés.
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Tape <code>supprimer</code> pour confirmer :
              </p>
              <input
                type="text"
                className="form-input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="supprimer"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") void handleReset() }}
              />
              {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConfirm(false)}>
                Annuler
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={confirm.trim().toLowerCase() !== "supprimer" || loading}
                onClick={() => void handleReset()}
              >
                {loading ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main client component ─────────────────────────────────────────────────────
export function ParametresClient() {
  const { data: session } = useSession()
  const { private: priv, toggle: togglePrivacy } = usePrivacy()
  const { theme, toggle: toggleTheme } = useTheme()

  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs)
  const [profile, setProfile] = useState<ProfileKey>("equilibre")
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    setPrefs(loadPrefs())
    setProfile(loadProfile())
  }, [])

  const updatePref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      savePrefs(next)
      if (key === "anon") document.documentElement.dataset.anon = value ? "on" : "off"
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
                {Object.entries(CURRENCIES).map(([k, c]) => (
                  <option key={k} value={k} disabled={k !== "EUR"}>{k} — {c.name} ({c.sym}){k !== "EUR" ? " · bientôt" : ""}</option>
                ))}
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
          <div className="field-hint" style={{ marginTop: 8 }}>Tous les montants sont affichés en euro. Chaque compte conserve sa devise d&apos;origine.</div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Profil d&apos;investisseur</label>
            <div className="chips" style={{ margin: 0 }}>
              {(Object.keys(PROFILES) as ProfileKey[]).map((k) => (
                <button key={k} type="button" className={`chip${profile === k ? " active" : ""}`} onClick={() => { setProfile(k); saveProfile(k) }}>{PROFILES[k].label}</button>
              ))}
            </div>
            <div className="field-hint">
              Allocation cible : {Object.entries(PROFILES[profile].target).filter(([, v]) => v).map(([k, v]) => `${ASSET_LABEL[k] ?? k} ${v} %`).join(" · ")}
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
                <div className="set-desc">À 90 % du plafond d&apos;une catégorie</div>
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
                <div className="set-name">Récapitulatif mensuel</div>
                <div className="set-desc">Le 1er de chaque mois par e-mail</div>
              </div>
              <button
                className="switch"
                aria-pressed={prefs.alertReport}
                onClick={() => updatePref("alertReport", !prefs.alertReport)}
              >
                <span />
              </button>
            </div>
            <div className="set-row">
              <div className="flex-1">
                <div className="set-name">Rappel d&apos;épargne</div>
                <div className="set-desc">Chaque semaine si aucun versement</div>
              </div>
              <button
                className="switch"
                aria-pressed={prefs.alertSave}
                onClick={() => updatePref("alertSave", !prefs.alertSave)}
              >
                <span />
              </button>
            </div>
          </div>
        </div>

        {/* ── Card 4: Données & compte ───────────────────────────────── */}
        <DataCard anon={prefs.anon} onAnon={() => updatePref("anon", !prefs.anon)} onPassword={() => setShowPasswordModal(true)} />
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
