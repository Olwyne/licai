"use client"
import { useEffect } from "react"

/** Applique le mode démo anonymisé (réglage enregistré dans le navigateur) sur toutes les pages. */
export function AnonSync() {
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("licai-prefs") ?? "{}") as { anon?: boolean }
      document.documentElement.dataset.anon = p.anon ? "on" : "off"
    } catch { document.documentElement.dataset.anon = "off" }
  }, [])
  return null
}
