"use client"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AuthShell } from "@/components/features/auth/AuthShell"
import { AUTH_ASIDE } from "@/components/features/auth/aside"
import { passwordIssue, passwordStrength } from "@/lib/password"

function ResetForm() {
  const token = useSearchParams().get("token") ?? ""
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const strength = passwordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const issue = passwordIssue(password)
    if (issue) { setError(issue); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/auth/reset", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
    })
    setLoading(false)
    if (res.ok) setDone(true)
    else setError((await res.json().catch(() => ({}))).error ?? "Erreur, réessayez.")
  }

  return (
    <>
      <h1 className="auth-h">Nouveau mot de passe</h1>
      <p className="auth-p">Choisissez un mot de passe pour votre compte.</p>
      {done ? (
        <>
          <div className="disclaimer"><i aria-hidden="true" className="ti ti-circle-check" /><span>Mot de passe mis à jour. Vous pouvez vous connecter.</span></div>
          <div className="alt"><a href="/login">Se connecter</a></div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="pw">Nouveau mot de passe</label>
            <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="12 caractères minimum" required />
            <div className="strength">{[0, 1, 2, 3].map((i) => <span key={i} className={i < strength ? "on" : ""} />)}</div>
            <div className="hint">Au moins 12 caractères, dont une majuscule et un chiffre.</div>
          </div>
          {error && <div className="err on">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading || !token}>
            <i aria-hidden="true" className="ti ti-key" /> {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell {...AUTH_ASIDE.login}>
      <Suspense><ResetForm /></Suspense>
    </AuthShell>
  )
}
