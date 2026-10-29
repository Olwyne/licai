"use client"
import { CURRENCIES, FIAT_CODES, getBaseCurrency } from "@/lib/finance/fx"
import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"
import Link from "next/link"
import { PROFILES, type ProfileKey } from "@/lib/finance/invest"
import { PREFS_EVENT, saveProfile, subscribePrefs, useStoredProfile } from "@/components/features/finance/quotes"
import { useAssistant } from "@/contexts/AssistantContext"
import { ConnModal } from "@/components/features/assistant/ConnModal"

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
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch { /* stockage indisponible */ }
  try { window.dispatchEvent(new Event(PREFS_EVENT)) } catch { /* hors navigateur */ }
}

const DEFAULT_PREFS_RAW = ""
const readPrefsRaw = (): string => { try { return localStorage.getItem(PREF_KEY) ?? "" } catch { return "" } }
const parsePrefs = (raw: string): Prefs => {
  try { if (raw) return { ...defaultPrefs(), ...(JSON.parse(raw) as Partial<Prefs>) } } catch { /* valeurs par défaut */ }
  return defaultPrefs()
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
            <i aria-hidden="true" className="ti ti-x" />
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
            <i aria-hidden="true" className="ti ti-x" />
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
      <i aria-hidden="true" className={`ti ${icon}`} />
      <div className="flex-1"><div className="set-name">{name}</div><div className="set-desc">{desc}</div></div>
      <i aria-hidden="true" className="ti ti-chevron-right set-chev" />
    </button>
  )

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Données &amp; compte</div></div>
      <div className="set-list">
        {action("ti-file-spreadsheet", "Exporter les transactions", "CSV compatible Excel et Google Sheets", () => { window.open("/api/export/transactions", "_self") })}
        {action("ti-chart-candle", "Exporter le portefeuille", "Lignes, prix de revient et plus-values latentes", () => { window.open("/api/export/portfolio", "_self") })}
        {action("ti-file-text", "Rapport patrimonial", "Synthèse imprimable ou PDF", () => { window.open("/rapport", "_blank") })}
        {action("ti-database-export", "Sauvegarde complète", "Fichier JSON de toutes les données du foyer", () => { window.open("/api/export", "_self") })}
        <label className="set-action" style={{ cursor: "pointer" }}>
          <i aria-hidden="true" className="ti ti-database-import" />
          <div className="flex-1"><div className="set-name">Importer une sauvegarde</div><div className="set-desc">{importing ? "Lecture…" : "Fichier JSON exporté depuis Lǐcái"}</div></div>
          <i aria-hidden="true" className="ti ti-chevron-right set-chev" />
          <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
        </label>
        {importMsg && <p className="set-desc" style={{ padding: "8px 14px" }}>{importMsg}</p>}
        <div className="set-row">
          <div className="flex-1"><div className="set-name">Mode démo anonymisé</div><div className="set-desc">Masque noms, banques et libellés pour partager un écran</div></div>
          <button className="switch" aria-pressed={anon} onClick={onAnon} type="button"><span /></button>
        </div>
        <Link className="set-action" href="/comptes">
          <i aria-hidden="true" className="ti ti-building-bank" />
          <div className="flex-1"><div className="set-name">Comptes bancaires</div><div className="set-desc">{acctDesc}</div></div>
          <i aria-hidden="true" className="ti ti-chevron-right set-chev" />
        </Link>
        <a className="set-action" href="/legal/mentions-legales.html" target="_blank" rel="noreferrer">
          <i aria-hidden="true" className="ti ti-gavel" />
          <div className="flex-1"><div className="set-name">Mentions légales</div><div className="set-desc">Statut, responsabilité, données personnelles</div></div>
          <i aria-hidden="true" className="ti ti-chevron-right set-chev" />
        </a>
        <a className="set-action" href="/legal/conditions.html" target="_blank" rel="noreferrer">
          <i aria-hidden="true" className="ti ti-file-text" />
          <div className="flex-1"><div className="set-name">Conditions d&apos;utilisation</div><div className="set-desc">Version 1.2 · 1er juin 2026</div></div>
          <i aria-hidden="true" className="ti ti-chevron-right set-chev" />
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
        <i aria-hidden="true" className="ti ti-trash" />
        <div className="flex-1">
          <div className="set-name">Supprimer toutes les données</div>
          <div className="set-desc">Transactions, comptes, objectifs… Le compte utilisateur est conservé.</div>
        </div>
        <i aria-hidden="true" className="ti ti-chevron-right set-chev" />
      </button>

      {done && (
        <p className="set-desc" style={{ padding: "8px 14px", color: "var(--primary-ink)" }}>
          <i aria-hidden="true" className="ti ti-circle-check" /> Toutes les données ont été supprimées.
        </p>
      )}

      {showConfirm && (
        <div className="modal-overlay open" onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ color: "var(--danger)" }}>
                <i aria-hidden="true" className="ti ti-alert-triangle" /> Supprimer toutes les données
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConfirm(false)}>
                <i aria-hidden="true" className="ti ti-x" />
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
const AI_PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)", hint: "sk-ant-…" },
  { id: "openai", label: "ChatGPT (OpenAI)", hint: "sk-…" },
  { id: "gemini", label: "Gemini (Google)", hint: "AIza…" },
] as const

function AiKeyCard({ onAdvanced }: { onAdvanced: () => void }) {
  const { available, keySource, keyHint, keyUnreadable, aiProvider, chosenModel, provider, refresh } = useAssistant()
  const [prov, setProv] = useState<string>(aiProvider)
  const [model, setModel] = useState(chosenModel)
  const [models, setModels] = useState<{ recommended: string; list: string[] }>({ recommended: "", list: [] })
  const [value, setValue] = useState("")
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const saved = keySource === "account"
  const hint = AI_PROVIDERS.find((p) => p.id === prov)?.hint ?? ""

  // le fournisseur/modèle enregistrés changent (rechargement du statut) : le formulaire repart de ces valeurs
  const [synced, setSynced] = useState({ aiProvider, chosenModel })
  if (synced.aiProvider !== aiProvider || synced.chosenModel !== chosenModel) {
    setSynced({ aiProvider, chosenModel }); setProv(aiProvider); setModel(chosenModel)
  }
  // modèles accessibles avec la clé enregistrée + modèle recommandé automatiquement
  useEffect(() => {
    if (!available) return
    let live = true
    fetch("/api/assistant/models").then((r) => (r.ok ? r.json() : null)).then((j: { data?: { recommended: string; models: string[] } } | null) => {
      if (live && j?.data) setModels({ recommended: j.data.recommended, list: j.data.models })
    }).catch(() => {})
    return () => { live = false }
  }, [available, aiProvider, keySource])

  async function toggleShow() {
    // clé enregistrée mais pas saisie ici : on la relit côté serveur pour l'afficher
    if (!shown && !value && saved) {
      const r = await fetch("/api/assistant/key")
      if (r.ok) setValue(((await r.json()) as { data: { key: string } }).data.key)
    }
    setShown((v) => !v)
  }

  async function save(body: { key?: string }, done: string) {
    setBusy(true); setMsg("")
    const r = await fetch("/api/assistant/key", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: prov, model, ...body }) })
    const j = (await r.json().catch(() => null)) as { data?: { warning?: string }; error?: string } | null
    setBusy(false)
    if (!r.ok) { setMsg(j?.error ?? "Erreur d'enregistrement."); return }
    setValue(""); setShown(false)
    setMsg(`${done}${j?.data?.warning ? ` ${j.data.warning}` : ""}`)
    await refresh()
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Assistant financier IA</div></div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ai-provider">Fournisseur</label>
          <select id="ai-provider" value={prov} onChange={(e) => { setProv(e.target.value); setModel(""); setMsg("") }}>
            {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ai-model">Modèle</label>
          <select id="ai-model" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">{models.recommended && prov === aiProvider ? `Automatique — ${models.recommended}` : "Automatique (le plus pertinent)"}</option>
            {prov === aiProvider && models.list.map((m) => <option key={m} value={m}>{m}</option>)}
            {model && !models.list.includes(model) && <option value={model}>{model}</option>}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ai-key">Clé API</label>
        <div className="field-amount">
          <input
            id="ai-key" type={shown ? "text" : "password"} autoComplete="off" spellCheck={false}
            value={value} onChange={(e) => { setValue(e.target.value); setMsg("") }}
            placeholder={saved ? `Clé enregistrée ${keyHint}` : hint}
            style={{ fontSize: 14, fontWeight: 500, paddingRight: 44 }}
          />
          <button type="button" className="icon-btn" onClick={() => void toggleShow()} aria-pressed={shown}
            aria-label={shown ? "Masquer la clé" : "Afficher la clé"} title={shown ? "Masquer la clé" : "Afficher la clé"}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 30, height: 30 }}>
            <i aria-hidden="true" className={`ti ${shown ? "ti-eye-off" : "ti-eye"}`} />
          </button>
        </div>
        <div className="field-hint">
          {available
            ? keySource === "account" ? `Assistant activé avec la clé de votre compte (${keyHint}).` : keySource === "server" ? "Assistant activé avec la clé du serveur (variable d'environnement)." : "Assistant activé via un fournisseur externe."
            : "Sans clé API, l'assistant est désactivé : la bulle de conseil n'apparaît pas."}
          {" "}La clé est vérifiée auprès du fournisseur, chiffrée sur le serveur et n&apos;est renvoyée au navigateur que si vous cliquez sur l&apos;œil. En mode « Automatique », l&apos;app choisit le modèle le plus pertinent parmi ceux de votre compte.
        </div>
      </div>
      {keyUnreadable && <div className="disclaimer sm" role="alert"><i aria-hidden="true" className="ti ti-alert-triangle" /><span>La clé enregistrée est <b>illisible</b> : le secret du serveur (NEXTAUTH_SECRET) a changé depuis son enregistrement. Saisissez-la à nouveau.</span></div>}
      {msg && <div className="field-hint" role="status">{msg}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" type="button" disabled={busy || (!value.trim() && !(saved && (prov !== aiProvider || model !== chosenModel)))}
          onClick={() => void save(value.trim() ? { key: value.trim() } : {}, value.trim() ? "Clé enregistrée." : "Préférences enregistrées.")}>
          <i aria-hidden="true" className="ti ti-check" /> {value.trim() ? "Enregistrer la clé" : "Enregistrer"}
        </button>
        {saved && <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void save({ key: "" }, "Clé supprimée.")}><i aria-hidden="true" className="ti ti-trash" /> Supprimer la clé</button>}
        <button className="btn btn-ghost btn-sm" type="button" onClick={onAdvanced}>{provider.mode === "custom" ? "Point d'accès externe : modifier" : "Utiliser un point d'accès externe"}</button>
      </div>
      <div className="field-hint" style={{ marginTop: 8 }}>La bulle en bas à droite conseille à partir de l&apos;ensemble des données de l&apos;application (comptes, transactions, budgets, crédits, immobilier, placements, impôts). Rien n&apos;est envoyé avant votre premier message.</div>
    </div>
  )
}

export function ParametresClient() {
  const { data: session } = useSession()
  const { private: priv, toggle: togglePrivacy } = usePrivacy()
  const { theme, toggle: toggleTheme } = useTheme()
  const assistant = useAssistant()
  const [connOpen, setConnOpen] = useState(false)

  // préférences du navigateur : valeurs par défaut au rendu serveur, puis valeurs enregistrées (sans setState dans un effet)
  const prefsRaw = useSyncExternalStore(subscribePrefs, readPrefsRaw, () => DEFAULT_PREFS_RAW)
  const prefs = useMemo(() => parsePrefs(prefsRaw), [prefsRaw])
  const profile = useStoredProfile()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  async function changeCurrency(cur: string) {
    if (cur === getBaseCurrency()) return
    if (!window.confirm(`Passer la devise de référence en ${cur} ? Les montants déjà saisis ne sont pas convertis : ils seront simplement affichés en ${cur}. Les taux de change sont recalculés.`)) return
    const res = await fetch("/api/fx", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: cur }) })
    if (res.ok) window.location.reload()
  }

  const updatePref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    savePrefs({ ...parsePrefs(readPrefsRaw()), [key]: value })
    if (key === "anon") document.documentElement.dataset.anon = value ? "on" : "off"
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
              <label>Devise de référence</label>
              <select value={getBaseCurrency()} onChange={e => changeCurrency(e.target.value)}>
                {FIAT_CODES.map(k => (
                  <option key={k} value={k}>{k} — {CURRENCIES[k].name} ({CURRENCIES[k].sym})</option>
                ))}
              </select>
              <div className="field-hint">Les totaux sont exprimés dans cette devise. Les comptes et placements en devises étrangères (yen, crypto…) y sont convertis aux taux du foyer.</div>
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
          <div className="field-hint" style={{ marginTop: 8 }}>Tous les montants sont affichés dans la devise de référence. Chaque compte conserve sa devise d&apos;origine.</div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Profil d&apos;investisseur</label>
            <div className="chips" style={{ margin: 0 }}>
              {(Object.keys(PROFILES) as ProfileKey[]).map((k) => (
                <button key={k} type="button" className={`chip${profile === k ? " active" : ""}`} onClick={() => saveProfile(k)}>{PROFILES[k].label}</button>
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

        <AiKeyCard onAdvanced={() => setConnOpen(true)} />

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
      {connOpen && <ConnModal provider={assistant.provider} onClose={() => setConnOpen(false)} onSave={(p) => { assistant.setProvider(p); setConnOpen(false) }} />}

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
