import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { sendTelegramVolumeSignalMessage } from "@/lib/telegram-bot"
import { startVolumeAlertScheduler } from "@/lib/volume-alert-scheduler"
import {
  normalizeAddress,
  readVolumeAlertItems,
  toAddressKey,
  toShortAddress,
  writeVolumeAlertItems,
  type VolumeAlertItem,
  type VolumeMomentum,
} from "@/lib/volume-alert-storage"

export const runtime = "nodejs"

type CreatePayload = {
  chainIndex?: string
  chainLabel?: string
  address?: string
  period?: string
  monitorDown?: boolean
}

type PatchPayload =
  | {
      action?: "togglePause"
      id?: string
    }
  | {
      action?: "updatePeriod"
      id?: string
      period?: string
    }
  | {
      action?: "updateMomentum"
      id?: string
      momentum?: VolumeMomentum
      momentumText?: string
      momentumRatio?: number | null
      lastCheckedAt?: string | null
    }

const MAX_TOKEN_COUNT = 100

// Start singleton scheduler in the server process. Safe to call multiple times.
startVolumeAlertScheduler()

export async function GET() {
  const items = await readVolumeAlertItems()
  return NextResponse.json({ code: "0", msg: "success", data: items })
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreatePayload

    const chainIndex = payload.chainIndex?.trim() ?? ""
    const chainLabel = payload.chainLabel?.trim() ?? ""
    const address = normalizeAddress(payload.address ?? "")
    const period = payload.period?.trim() ?? ""
    const monitorDown = payload.monitorDown === true

    if (!chainIndex || !chainLabel || !address || !period) {
      return NextResponse.json({ code: "400", msg: "缺少必要参数", data: null }, { status: 400 })
    }

    const items = await readVolumeAlertItems()
    if (items.length >= MAX_TOKEN_COUNT) {
      return NextResponse.json(
        { code: "400", msg: `最多只支持添加 ${MAX_TOKEN_COUNT} 个代币`, data: null },
        { status: 400 }
      )
    }

    const duplicated = items.some((item) => toAddressKey(item.address) === toAddressKey(address))
    if (duplicated) {
      return NextResponse.json({ code: "409", msg: "地址已存在", data: null }, { status: 409 })
    }

    const newItem: VolumeAlertItem = {
      id: randomUUID(),
      chainIndex,
      chainLabel,
      address,
      tokenName: toShortAddress(address),
      period,
      monitorDown,
      status: "ONLINE",
      momentum: "NONE",
      momentumText: "待检测",
      momentumRatio: null,
      lastCheckedAt: null,
      createdAt: new Date().toISOString(),
    }

    const nextItems = [newItem, ...items]
    await writeVolumeAlertItems(nextItems)

    return NextResponse.json({ code: "0", msg: "添加成功", data: newItem })
  } catch {
    return NextResponse.json({ code: "500", msg: "添加失败", data: null }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as PatchPayload
    const id = payload.id?.trim() ?? ""

    if (!id) {
      return NextResponse.json({ code: "400", msg: "缺少 id", data: null }, { status: 400 })
    }

    const items = await readVolumeAlertItems()
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) {
      return NextResponse.json({ code: "404", msg: "记录不存在", data: null }, { status: 404 })
    }

    const current = items[index]

    if (payload.action === "togglePause") {
      const updated: VolumeAlertItem = {
        ...current,
        status: current.status === "ONLINE" ? "PAUSED" : "ONLINE",
      }
      items[index] = updated
      await writeVolumeAlertItems(items)
      return NextResponse.json({ code: "0", msg: "success", data: updated })
    }

    if (payload.action === "updatePeriod") {
      const period = payload.period?.trim() ?? ""
      if (!period) {
        return NextResponse.json({ code: "400", msg: "时间周期不能为空", data: null }, { status: 400 })
      }

      const updated: VolumeAlertItem = {
        ...current,
        period,
        momentum: "NONE",
        momentumText: "待检测",
        momentumRatio: null,
        lastCheckedAt: null,
      }

      items[index] = updated
      await writeVolumeAlertItems(items)
      return NextResponse.json({ code: "0", msg: "success", data: updated })
    }

    if (payload.action === "updateMomentum") {
      const momentum = payload.momentum
      if (momentum !== "UP" && momentum !== "DOWN" && momentum !== "NONE" && momentum !== "ERROR") {
        return NextResponse.json({ code: "400", msg: "无效的动量类型", data: null }, { status: 400 })
      }

      const momentumText = payload.momentumText?.trim() || "待检测"
      const momentumRatio =
        typeof payload.momentumRatio === "number" && Number.isFinite(payload.momentumRatio)
          ? payload.momentumRatio
          : null
      const updated: VolumeAlertItem = {
        ...current,
        momentum,
        momentumText,
        momentumRatio,
        lastCheckedAt: payload.lastCheckedAt ?? new Date().toISOString(),
      }

      items[index] = updated
      await writeVolumeAlertItems(items)

      const isSignal = momentum === "UP" || momentum === "DOWN"
      const shouldNotifyDown = updated.monitorDown
      const allowNotifyByDirection = momentum === "UP" || (momentum === "DOWN" && shouldNotifyDown)
      const isNewSignal = current.momentum !== momentum
      if (isSignal && allowNotifyByDirection && isNewSignal) {
        try {
          await sendTelegramVolumeSignalMessage({
            signal: momentum,
            address: updated.address,
            chain: updated.chainLabel,
            period: updated.period,
            ratio: updated.momentumRatio,
          })
        } catch {
          // Notification failure should not block state persistence.
        }
      }

      return NextResponse.json({ code: "0", msg: "success", data: updated })
    }

    return NextResponse.json({ code: "400", msg: "未知 action", data: null }, { status: 400 })
  } catch {
    return NextResponse.json({ code: "500", msg: "更新失败", data: null }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const items = await readVolumeAlertItems()
    const deleteAll = searchParams.get("all") === "1"
    const idsParam = (searchParams.get("ids") ?? "").trim()
    const singleId = (searchParams.get("id") ?? "").trim()

    if (deleteAll) {
      await writeVolumeAlertItems([])
      return NextResponse.json({ code: "0", msg: "删除成功", data: { deletedCount: items.length } })
    }

    const ids = idsParam
      ? idsParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : singleId
        ? [singleId]
        : []

    if (!ids.length) {
      return NextResponse.json({ code: "400", msg: "缺少删除参数", data: null }, { status: 400 })
    }

    const idSet = new Set(ids)
    const nextItems = items.filter((item) => !idSet.has(item.id))
    const deletedCount = items.length - nextItems.length

    if (deletedCount <= 0) {
      return NextResponse.json({ code: "404", msg: "记录不存在", data: null }, { status: 404 })
    }

    await writeVolumeAlertItems(nextItems)

    return NextResponse.json({ code: "0", msg: "删除成功", data: { deletedCount } })
  } catch {
    return NextResponse.json({ code: "500", msg: "删除失败", data: null }, { status: 500 })
  }
}
