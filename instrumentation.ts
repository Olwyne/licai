// Au démarrage du serveur : refuse de tourner en production avec un secret manquant ou faible.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return
  const { guardProductionConfig } = await import("./instrumentation-node")
  guardProductionConfig()
}
