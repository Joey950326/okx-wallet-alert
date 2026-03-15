import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import { NextResponse } from "next/server"

import { sendTelegramVolumeSignalMessage } from "@/lib/telegram-bot"

export const runtime = "nodejs"

type VolumeAlertStatus = "ONLINE" | "PAUSED"

type VolumeMomentum = "UP" | "DOWN" | "NONE" | "ERROR"

type VolumeAlertItem = {
  id: string
  chainIndex: string
  chainLabel: string
  address: string
  tokenName: string
  period: string
  status: VolumeAlertStatus
  momentum: VolumeMomentum
  momentumText: string
  momentumRatio: number | null
  lastCheckedAt: string | null
  createdAt: string
}

type CreatePayload = {
  chainIndex?: string
  chainLabel?: string
  address?: string
  period?: string
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

const DATA_FILE_PATH = path.join(process.cwd(), "logs", "volume-alert-items.json")

function normalizeAddress(value: string) {
  return value.trim()
}

function toAddressKey(value: string) {
  return value.trim().toLowerCase()
}

function toShortAddress(address: string) {
  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

async function ensureDataFile() {
  const directory = path.dirname(DATA_FILE_PATH)
  await fs.mkdir(directory, { recursive: true })

  try {
    await fs.access(DATA_FILE_PATH)
  } catch {
    await fs.writeFile(DATA_FILE_PATH, "[]", "utf-8")
  }
}

async function readItems(): Promise<VolumeAlertItem[]> {
  await ensureDataFile()

  try {
    const raw = await fs.readFile(DATA_FILE_PATH, "utf-8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null
        }

        const candidate = item as Partial<VolumeAlertItem> & { status?: string }
        const normalizedStatus: VolumeAlertStatus | null =
          candidate.status === "ONLINE" || candidate.status === "PAUSED"
            ? candidate.status
            : candidate.status === "RUNNING"
              ? "ONLINE"
              : null

        if (!normalizedStatus) {
          return null
        }

        if (
          typeof candidate.id !== "string" ||
          typeof candidate.chainIndex !== "string" ||
          typeof candidate.chainLabel !== "string" ||
          typeof candidate.address !== "string" ||
          typeof candidate.tokenName !== "string" ||
          typeof candidate.period !== "string" ||
          (candidate.momentum !== "UP" &&
            candidate.momentum !== "DOWN" &&
            candidate.momentum !== "NONE" &&
            candidate.momentum !== "ERROR") ||
          typeof candidate.momentumText !== "string" ||
          (typeof candidate.momentumRatio !== "number" && candidate.momentumRatio !== null && candidate.momentumRatio !== undefined) ||
          (typeof candidate.lastCheckedAt !== "string" && candidate.lastCheckedAt !== null) ||
          typeof candidate.createdAt !== "string"
        ) {
          return null
        }

        const normalizedItem: VolumeAlertItem = {
          id: candidate.id,
          chainIndex: candidate.chainIndex,
          chainLabel: candidate.chainLabel,
          address: candidate.address,
          tokenName: candidate.tokenName,
          period: candidate.period,
          status: normalizedStatus,
          momentum: candidate.momentum,
          momentumText: candidate.momentumText,
          momentumRatio:
            typeof candidate.momentumRatio === "number" && Number.isFinite(candidate.momentumRatio)
              ? candidate.momentumRatio
              : null,
          lastCheckedAt: candidate.lastCheckedAt,
          createdAt: candidate.createdAt,
        }

        return normalizedItem
      })
      .filter((item): item is VolumeAlertItem => {
        if (!item) {
          return false
        }

        const candidate = item as Partial<VolumeAlertItem>
        return (
          typeof candidate.id === "string" &&
          typeof candidate.chainIndex === "string" &&
          typeof candidate.chainLabel === "string" &&
          typeof candidate.address === "string" &&
          typeof candidate.tokenName === "string" &&
          typeof candidate.period === "string" &&
          (candidate.status === "ONLINE" || candidate.status === "PAUSED") &&
          (candidate.momentum === "UP" ||
            candidate.momentum === "DOWN" ||
            candidate.momentum === "NONE" ||
            candidate.momentum === "ERROR") &&
          typeof candidate.momentumText === "string" &&
          (typeof candidate.momentumRatio === "number" || candidate.momentumRatio === null) &&
          (typeof candidate.lastCheckedAt === "string" || candidate.lastCheckedAt === null) &&
          typeof candidate.createdAt === "string"
        )
      })
  } catch {
    return []
  }
}

async function writeItems(items: VolumeAlertItem[]) {
  await ensureDataFile()
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(items, null, 2), "utf-8")
}

export async function GET() {
  const items = await readItems()
  return NextResponse.json({ code: "0", msg: "success", data: items })
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreatePayload

    const chainIndex = payload.chainIndex?.trim() ?? ""
    const chainLabel = payload.chainLabel?.trim() ?? ""
    const address = normalizeAddress(payload.address ?? "")
    const period = payload.period?.trim() ?? ""

    if (!chainIndex || !chainLabel || !address || !period) {
      return NextResponse.json({ code: "400", msg: "缺少必要参数", data: null }, { status: 400 })
    }

    const items = await readItems()
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
      status: "ONLINE",
      momentum: "NONE",
      momentumText: "待检测",
      momentumRatio: null,
      lastCheckedAt: null,
      createdAt: new Date().toISOString(),
    }

    const nextItems = [newItem, ...items]
    await writeItems(nextItems)

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

    const items = await readItems()
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
      await writeItems(items)
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
      await writeItems(items)
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
      await writeItems(items)

      const isSignal = momentum === "UP" || momentum === "DOWN"
      const isNewSignal = current.momentum !== momentum
      if (isSignal && isNewSignal) {
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
    const items = await readItems()
    const deleteAll = searchParams.get("all") === "1"
    const idsParam = (searchParams.get("ids") ?? "").trim()
    const singleId = (searchParams.get("id") ?? "").trim()

    if (deleteAll) {
      await writeItems([])
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

    await writeItems(nextItems)

    return NextResponse.json({ code: "0", msg: "删除成功", data: { deletedCount } })
  } catch {
    return NextResponse.json({ code: "500", msg: "删除失败", data: null }, { status: 500 })
  }
}
