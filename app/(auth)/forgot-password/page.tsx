"use client"
import { useState } from "react"
import { AuthShell } from "@/components/features/auth/AuthShell"
import { AUTH_ASIDE } from "@/components/features/auth/aside"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch("/api/auth/forgot", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).catch(() => {})
    setLoading(false)
    setSent(true)
  }

  return (
    <AuthShell {...AUTH_ASIDE.login}>
      <h1 className="auth-h">Mot de passe oublié</h1>
      <p className="auth-p">Saisissez l&apos;adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau.</p>
      {sent ? (
        <div className="disclaimer">
          <i className="ti ti-mail" />
          <span>Si un compte existe pour cette adresse, un lien de réinitialisation vient d&apos;être envoyé (valable 1 heure).</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sophie.lambert@email.fr" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            <i className="ti ti-mail" /> {loading ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>
      )}
      <div className="alt"><a href="/login">Retour à la connexion</a></div>
    </AuthShell>
  )
}
