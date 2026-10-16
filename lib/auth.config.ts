import type { NextAuthConfig } from "next-auth"

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // « Rester connecté » : 30 jours
export const SHORT_SESSION_MS = 12 * 60 * 60 * 1000 // sinon : 12 heures

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.householdId = (user as { householdId: string }).householdId
        token.keep = (user as { keep?: boolean }).keep !== false
        token.loginAt = Date.now()
      } else if (token.keep === false && Date.now() - (token.loginAt ?? 0) > SHORT_SESSION_MS) {
        return null
      }
      return token
    },
    session({ session, token }) {
      session.user.householdId = token.householdId as string
      return session
    },
    authorized({ auth }) {
      return !!auth?.user
    },
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig
