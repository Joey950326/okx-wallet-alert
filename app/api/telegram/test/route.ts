import { NextResponse } from "next/server"

import { sendTelegramTestMessage } from "@/lib/telegram-bot"

export const runtime = "nodejs"

type TelegramTestPayload = {
  address?: string
  chain?: string
}

export async function POST(request: Request) {
  try {
    let payload: TelegramTestPayload | null = null

    try {
      payload = (await request.json()) as TelegramTestPayload
    } catch {
      payload = null
    }

    const result = await sendTelegramTestMessage({
      address: payload?.address,
      chain: payload?.chain,
    })

    return NextResponse.json({
      code: "0",
      msg: "测试消息发送成功",
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "发送测试消息失败"
    return NextResponse.json(
      {
        code: "500",
        msg: message,
        data: null,
      },
      { status: 500 }
    )
  }
}
