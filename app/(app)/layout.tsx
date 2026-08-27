import { Sidebar } from "@/components/layout/Sidebar"
import { PrivacyProvider } from "@/contexts/PrivacyContext"
import { ThemeProvider } from "@/contexts/ThemeContext"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyProvider>
        <div className="app">
          <Sidebar />
          <main className="main">
            <div className="main-inner">{children}</div>
          </main>
        </div>
      </PrivacyProvider>
    </ThemeProvider>
  )
}
