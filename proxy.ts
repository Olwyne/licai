import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAuth = !!req.auth
  const path = req.nextUrl.pathname
  const isAuthPage = ["/login", "/setup", "/forgot-password", "/reset-password", "/legal"].some((p) => path.startsWith(p))

  if (!isAuth && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
}
