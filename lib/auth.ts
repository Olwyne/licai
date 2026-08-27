import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users, households } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .get()
        if (!user) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null
        return { id: user.id, email: user.email, householdId: user.householdId }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.householdId = (user as { householdId: string }).householdId
      return token
    },
    session({ session, token }) {
      session.user.householdId = token.householdId as string
      return session
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
})
