"use client"
import { useEffect, useState } from "react"

/** Incrémente à chaque changement de thème (data-theme) pour redessiner les graphiques. */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const obs = new MutationObserver(() => setTick((t) => t + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => obs.disconnect()
  }, [])
  return tick
}

export function chartColors(): { grid: string; fg: string; card: string } {
  if (typeof window === "undefined") return { grid: "rgba(255,255,255,.05)", fg: "#999", card: "#18181b" }
  const cs = getComputedStyle(document.documentElement)
  return {
    grid: cs.getPropertyValue("--chart-grid").trim() || "rgba(255,255,255,.05)",
    fg: cs.getPropertyValue("--fg-secondary").trim() || "#999",
    card: cs.getPropertyValue("--card").trim() || "#18181b",
  }
}
