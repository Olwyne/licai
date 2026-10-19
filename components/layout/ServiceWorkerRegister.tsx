"use client"
import { useEffect } from "react"

// Enregistre le service worker (/sw.js) en production : application installable et page hors ligne.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* non bloquant */ })
  }, [])
  return null
}
