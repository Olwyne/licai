import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

import { SHORT_SESSION_MS, SESSION_MAX_AGE } from "@/lib/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        keep: { label: "Rester connecté", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = db
          .select()
          .from(users)
          .where(eq(users.email, (credentials.email as string).trim().toLowerCase()))
          .get()
        if (!user) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined
        return { id: user.id, email: user.email, name, householdId: user.householdId, keep: credentials.keep !== "0" }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.householdId = (user as { householdId: string }).householdId
        token.keep = (user as { keep?: boolean }).keep !== false
        token.loginAt = Date.now()
      } else if (token.keep === false && Date.now() - (token.loginAt ?? 0) > SHORT_SESSION_MS) {
        return null // session « non mémorisée » expirée
      }
      return token
    },
    session({ session, token }) {
      session.user.householdId = token.householdId as string
      return session
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  trustHost: true,
})
