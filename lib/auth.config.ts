import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.householdId = (user as { householdId: string }).householdId
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
} satisfies NextAuthConfig
