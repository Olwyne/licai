import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { CurrencyInit } from "@/components/layout/CurrencyInit"
import { NavProvider } from "@/contexts/NavContext"
import { MobileBar } from "@/components/layout/MobileBar"
import { PeriodProvider } from "@/contexts/PeriodContext"
import { Sidebar } from "@/components/layout/Sidebar"
import { PrivacyProvider } from "@/contexts/PrivacyContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { AssistantProvider } from "@/contexts/AssistantContext"
import { CmdPaletteWrapper } from "@/components/features/search/CmdPaletteWrapper"
import { AnonSync } from "@/components/features/parametres/AnonSync"
import { AssistantChat } from "@/components/features/assistant/AssistantChat"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hid = (await auth())?.user?.householdId
  const currency = (hid && db.select().from(households).where(eq(households.id, hid)).get()?.currency) || "EUR"
  return (
    <ThemeProvider>
      <CurrencyInit currency={currency} />
      <PrivacyProvider>
        <NavProvider>
        <PeriodProvider>
        <AssistantProvider>
          <CmdPaletteWrapper>
            <div className="app">
              <Sidebar />
              <main className="main">
                <MobileBar />
                <div className="main-inner">{children}</div>
              </main>
            </div>
            <AssistantChat />
            <AnonSync />
          </CmdPaletteWrapper>
        </AssistantProvider>
      </PeriodProvider>
        </NavProvider>
      </PrivacyProvider>
    </ThemeProvider>
  )
}
