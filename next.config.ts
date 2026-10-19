import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // standalone for Docker; Vercel uses its own bundling
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  turbopack: {},
  async headers() {
    // le service worker doit toujours être revalidé (mise à jour immédiate) et pouvoir contrôler tout le site
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }]
  },
}

export default nextConfig
