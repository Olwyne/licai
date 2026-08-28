import type { NextConfig } from "next"
import withPWA from "@ducanh2912/next-pwa"

const nextConfig: NextConfig = {
  // standalone for Docker; Vercel uses its own bundling
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  turbopack: {},
}

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig)
