import { PeriodPill } from "@/components/layout/PeriodPill"
import { Sidebar } from "@/components/layout/Sidebar"
import { PrivacyProvider } from "@/contexts/PrivacyContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { AssistantProvider } from "@/contexts/AssistantContext"
import { CmdPaletteWrapper } from "@/components/features/search/CmdPaletteWrapper"
import { AnonSync } from "@/components/features/parametres/AnonSync"
import { AssistantChat } from "@/components/features/assistant/AssistantChat"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyProvider>
        <AssistantProvider>
          <CmdPaletteWrapper>
            <div className="app">
              <Sidebar />
              <main className="main">
                <div className="main-inner"><PeriodPill />{children}</div>
              </main>
            </div>
            <AssistantChat />
            <AnonSync />
          </CmdPaletteWrapper>
        </AssistantProvider>
      </PrivacyProvider>
    </ThemeProvider>
  )
}
