import { NextResponse } from "next/server"

import { fetchGemList } from "@/lib/gem-list"

export const runtime = "nodejs"

export async function GET() {
  try {
    const gemList = await fetchGemList()
    return NextResponse.json({
      code: "0",
      msg: "success",
      data: { gemList },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      {
        code: "500",
        msg: message,
        data: { gemList: [] },
      },
      { status: 500 }
    )
  }
}
