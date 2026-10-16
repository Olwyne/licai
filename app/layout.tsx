import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "@tabler/icons-webfont/dist/tabler-icons.css"
import { SessionProvider } from "next-auth/react"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Lǐcái — Finances personnelles",
  description: "Comptes, budget, placements et patrimoine de votre foyer.",
  manifest: "/manifest.json",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable}`}>
        {process.env.NODE_ENV === "development" && (
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(r => r.unregister());
              });
            }
          `}} />
        )}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
