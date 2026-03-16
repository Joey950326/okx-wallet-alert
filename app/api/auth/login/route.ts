import { NextResponse } from "next/server"

import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
} from "@/lib/auth"
import { createSignedSessionToken } from "@/lib/auth-session"
import { getAuthCredentials } from "@/lib/auth-server"

type LoginPayload = {
  username?: string
  password?: string
}

export async function POST(request: Request) {
  try {
    const { username: authUsername, password: authPassword } = getAuthCredentials()
    const payload = (await request.json()) as LoginPayload
    const username = payload.username?.trim() ?? ""
    const password = payload.password?.trim() ?? ""

    if (username !== authUsername || password !== authPassword) {
      return NextResponse.json({ code: "401", msg: "账号或密码错误", data: null }, { status: 401 })
    }

    const token = await createSignedSessionToken(username)
    const response = NextResponse.json({ code: "0", msg: "登录成功", data: { username } })

    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    const isHttps = forwardedProto ? forwardedProto === "https" : new URL(request.url).protocol === "https:"

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: AUTH_MAX_AGE_SECONDS,
    })

    return response
  } catch {
    return NextResponse.json({ code: "500", msg: "登录失败", data: null }, { status: 500 })
  }
}
