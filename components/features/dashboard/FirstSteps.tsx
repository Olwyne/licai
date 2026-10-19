"use client"
import Link from "next/link"
import { useFetch } from "@/lib/use-fetch"
import { useLocalStorage } from "@/lib/use-local-storage"
import { onboardingProgress, type OnboardingCounts } from "@/lib/finance/onboarding"

// « Premiers pas » : ce qu'il reste à renseigner pour que le tableau de bord soit utile. Disparaît quand l'essentiel est fait (ou masqué).
export function FirstSteps() {
  const { data } = useFetch<{ counts: OnboardingCounts; household: string }>("/api/onboarding")
  const [hidden, setHidden] = useLocalStorage<boolean>("licai-first-steps-hidden", false)
  if (!data || hidden) return null
  const p = onboardingProgress(data.counts)
  if (p.complete) return null

  return (
    <section className="card first-steps" aria-labelledby="fs-title" data-testid="first-steps">
      <div className="card-header">
        <div>
          <h2 className="card-title" id="fs-title">Bienvenue ! Quatre étapes pour démarrer</h2>
          <div className="card-sub">{p.requiredDone} sur {p.required} faites — le tableau de bord se remplit au fur et à mesure.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHidden(true)}>Masquer</button>
      </div>
      <div className="fs-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.required} aria-valuenow={p.requiredDone} aria-label="Progression des premiers pas">
        <span style={{ width: `${(p.requiredDone / p.required) * 100}%` }} />
      </div>
      <ol className="fs-list">
        {p.steps.map((s) => (
          <li key={s.id} className={`fs-step${s.done ? " done" : ""}${s.id === p.next?.id ? " next" : ""}`}>
            <span className="fs-check" aria-hidden="true"><i className={`ti ${s.done ? "ti-check" : "ti-circle"}`} /></span>
            <div className="fs-text">
              <div className="fs-label">{s.label}{s.optional && <span className="fs-opt"> · facultatif</span>}{s.done && <span className="sr-only"> (fait)</span>}</div>
              <div className="fs-desc">{s.desc}</div>
            </div>
            {!s.done && <Link className={`btn btn-sm ${s.id === p.next?.id ? "btn-primary" : "btn-ghost"}`} href={s.href}>{s.id === p.next?.id ? "Commencer" : "Ouvrir"}</Link>}
          </li>
        ))}
      </ol>
    </section>
  )
}
