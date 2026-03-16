import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AUTH_COOKIE_NAME } from "@/lib/auth"
import { verifySignedSessionToken } from "@/lib/auth-session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
    return NextResponse.next()
  }

  if (pathname === "/login") {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    const session = await verifySignedSessionToken(token)
    if (session) {
      const target = request.nextUrl.clone()
      target.pathname = "/okx-jingou"
      target.search = ""
      return NextResponse.redirect(target)
    }
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const session = await verifySignedSessionToken(token)
  if (session) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/:path*"],
}
