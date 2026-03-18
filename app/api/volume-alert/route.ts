import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { sendTelegramVolumeSignalMessage } from "@/lib/telegram-bot"
import { startVolumeAlertScheduler } from "@/lib/volume-alert-scheduler"
import {
  appendVolumeAlertActivityLog,
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
      action?: "bulkUpdateByAge"
      olderThanHours?: number
      period?: string
    }
  | {
      action?: "togglePause"
      id?: string
    }
  | {
      action?: "updateConfig"
      id?: string
      period?: string
      monitorDown?: boolean
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
      source: "手动",
      period,
      monitorDown,
      status: "ONLINE",
      momentum: "NONE",
      momentumText: "待检测",
      momentumRatio: null,
      maxClose: null,
      minClose: null,
      lastCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    const nextItems = [newItem, ...items]
    await writeVolumeAlertItems(nextItems)
    await appendVolumeAlertActivityLog({
      action: "CREATE",
      itemId: newItem.id,
      address: newItem.address,
      detail: `period=${newItem.period}, monitorDown=${newItem.monitorDown}`,
    })

    return NextResponse.json({ code: "0", msg: "添加成功", data: newItem })
  } catch {
    return NextResponse.json({ code: "500", msg: "添加失败", data: null }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as PatchPayload

    if (payload.action === "bulkUpdateByAge") {
      const period = payload.period?.trim() ?? ""
      const olderThanHours =
        typeof payload.olderThanHours === "number" && Number.isFinite(payload.olderThanHours)
          ? payload.olderThanHours
          : NaN

      if (!period) {
        return NextResponse.json({ code: "400", msg: "时间周期不能为空", data: null }, { status: 400 })
      }
      if (!Number.isFinite(olderThanHours) || olderThanHours <= 0) {
        return NextResponse.json({ code: "400", msg: "创建时间参数无效", data: null }, { status: 400 })
      }

      const items = await readVolumeAlertItems()
      const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000
      let updatedCount = 0

      const nextItems = items.map((item) => {
        const createdMs = new Date(item.createdAt).getTime()
        const shouldUpdate = Number.isFinite(createdMs) && createdMs <= cutoff
        if (!shouldUpdate) {
          return item
        }

        updatedCount += 1
        return {
          ...item,
          period,
          momentum: "NONE" as const,
          momentumText: "待检测",
          momentumRatio: null,
          maxClose: item.maxClose,
          minClose: item.minClose,
          lastCheckedAt: new Date().toISOString(),
        }
      })

      if (updatedCount <= 0) {
        return NextResponse.json({ code: "404", msg: "没有符合条件的记录", data: null }, { status: 404 })
      }

      await writeVolumeAlertItems(nextItems)
      await appendVolumeAlertActivityLog({
        action: "UPDATE",
        detail: `bulkUpdateByAge olderThanHours=${olderThanHours} period=${period} count=${updatedCount}`,
      })

      return NextResponse.json({ code: "0", msg: "success", data: { updatedCount } })
    }

    const id = "id" in payload ? payload.id?.trim() ?? "" : ""

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
      await appendVolumeAlertActivityLog({
        action: "UPDATE",
        itemId: updated.id,
        address: updated.address,
        detail: `togglePause=>${updated.status}`,
      })
      return NextResponse.json({ code: "0", msg: "success", data: updated })
    }

    if (payload.action === "updateConfig") {
      const period = payload.period?.trim() ?? ""
      if (!period) {
        return NextResponse.json({ code: "400", msg: "时间周期不能为空", data: null }, { status: 400 })
      }
      const monitorDown = payload.monitorDown === true

      const updated: VolumeAlertItem = {
        ...current,
        period,
        monitorDown,
        momentum: "NONE",
        momentumText: "待检测",
        momentumRatio: null,
        maxClose: current.maxClose,
        minClose: current.minClose,
        // Reset baseline so the scheduler waits until the next boundary of the new period.
        lastCheckedAt: new Date().toISOString(),
      }

      items[index] = updated
      await writeVolumeAlertItems(items)
      await appendVolumeAlertActivityLog({
        action: "UPDATE",
        itemId: updated.id,
        address: updated.address,
        detail: `updateConfig=>period=${updated.period}, monitorDown=${updated.monitorDown}`,
      })
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
            maxRatio: null,
            minRatio: null,
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
    const confirm = (searchParams.get("confirm") ?? "").trim()
    const olderThanHoursParam = (searchParams.get("olderThanHours") ?? "").trim()
    const idsParam = (searchParams.get("ids") ?? "").trim()
    const singleId = (searchParams.get("id") ?? "").trim()

    if ((deleteAll || olderThanHoursParam) && confirm !== "yjsc") {
      return NextResponse.json({ code: "400", msg: "缺少确认口令", data: null }, { status: 400 })
    }

    if (deleteAll) {
      await writeVolumeAlertItems([])
      await appendVolumeAlertActivityLog({
        action: "DELETE",
        detail: `deleteAll count=${items.length}`,
      })
      return NextResponse.json({ code: "0", msg: "删除成功", data: { deletedCount: items.length } })
    }

    if (olderThanHoursParam) {
      const olderThanHours = Number(olderThanHoursParam)
      if (!Number.isFinite(olderThanHours) || olderThanHours <= 0) {
        return NextResponse.json({ code: "400", msg: "无效的 olderThanHours 参数", data: null }, { status: 400 })
      }

      const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000
      const nextItems = items.filter((item) => {
        const createdMs = new Date(item.createdAt).getTime()
        if (!Number.isFinite(createdMs)) {
          return true
        }

        return createdMs > cutoff
      })

      const deletedCount = items.length - nextItems.length
      if (deletedCount <= 0) {
        return NextResponse.json({ code: "404", msg: "没有符合条件的记录", data: null }, { status: 404 })
      }

      await writeVolumeAlertItems(nextItems)
      await appendVolumeAlertActivityLog({
        action: "DELETE",
        detail: `deleteByAge olderThanHours=${olderThanHours} count=${deletedCount}`,
      })

      return NextResponse.json({ code: "0", msg: "删除成功", data: { deletedCount } })
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
    await appendVolumeAlertActivityLog({
      action: "DELETE",
      detail: `deleteSelected count=${deletedCount}`,
    })

    return NextResponse.json({ code: "0", msg: "删除成功", data: { deletedCount } })
  } catch {
    return NextResponse.json({ code: "500", msg: "删除失败", data: null }, { status: 500 })
  }
}
