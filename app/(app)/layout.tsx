import { Sidebar } from "@/components/layout/Sidebar"
import { PrivacyProvider } from "@/contexts/PrivacyContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { CmdPaletteWrapper } from "@/components/features/search/CmdPaletteWrapper"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyProvider>
        <CmdPaletteWrapper>
          <div className="app">
            <Sidebar />
            <main className="main">
              <div className="main-inner">{children}</div>
            </main>
          </div>
        </CmdPaletteWrapper>
      </PrivacyProvider>
    </ThemeProvider>
  )
}
