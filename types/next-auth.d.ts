import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: { householdId: string } & DefaultSession["user"]
  }
  interface User {
    householdId: string
    keep?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    householdId: string
    keep?: boolean
    loginAt?: number
  }
}
