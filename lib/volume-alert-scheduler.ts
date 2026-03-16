import { getMarketCandles, type GetMarketCandlesParams } from "@/lib/okx-wallet"
import { sendTelegramVolumeSignalMessage } from "@/lib/telegram-bot"
import {
  readVolumeAlertItems,
  writeVolumeAlertItems,
  type VolumeAlertItem,
  type VolumeMomentum,
} from "@/lib/volume-alert-storage"

const POLL_OFFSET_MS = 10 * 1000
const REQUEST_GAP_MS = 1500
const GLOBAL_TICK_MS = 15 * 60 * 1000

let started = false
let intervalTimer: ReturnType<typeof setInterval> | null = null
let starterTimer: ReturnType<typeof setTimeout> | null = null
let isCycleRunning = false
let rerunRequested = false

type CandleItem = {
  ts: string
  o: string
  h: string
  l: string
  c: string
  vol: string
  volUsd: string
  confirm: string
}

function toPeriodMs(period: string) {
  const normalized = period.trim()
  const match = normalized.match(/^(\d+)\s*([a-zA-Z]+)$/)
  if (!match) {
    return 15 * 60 * 1000
  }

  const value = Number(match[1])
  const unit = (match[2] ?? "").toLowerCase()
  if (!Number.isFinite(value) || value <= 0) {
    return 15 * 60 * 1000
  }

  if (unit === "s") {
    return value * 1000
  }
  if (unit === "m") {
    return value * 60 * 1000
  }
  if (unit === "h") {
    return value * 60 * 60 * 1000
  }
  if (unit === "d") {
    return value * 24 * 60 * 60 * 1000
  }
  if (unit === "w") {
    return value * 7 * 24 * 60 * 60 * 1000
  }

  return 15 * 60 * 1000
}

function analyzeMomentum(candles: CandleItem[]): {
  momentum: VolumeMomentum
  momentumText: string
  momentumRatio: number | null
} {
  if (!Array.isArray(candles) || candles.length < 3) {
    return {
      momentum: "NONE",
      momentumText: "K线不足",
      momentumRatio: null,
    }
  }

  const sorted = [...candles].sort((a, b) => Number(b.ts) - Number(a.ts))
  const current = sorted[1]
  const prev = sorted[2]

  const prevVol = Number(prev.vol)
  const currentVol = Number(current.vol)
  const currentOpen = Number(current.o)
  const currentClose = Number(current.c)

  if (!Number.isFinite(prevVol) || !Number.isFinite(currentVol) || !Number.isFinite(currentOpen) || !Number.isFinite(currentClose)) {
    return {
      momentum: "ERROR",
      momentumText: "数据异常",
      momentumRatio: null,
    }
  }

  const ratio = prevVol > 0 ? currentVol / prevVol : null

  if (currentVol >= prevVol * 3) {
    if (currentClose > currentOpen) {
      return {
        momentum: "UP",
        momentumText: "增量上涨",
        momentumRatio: ratio,
      }
    }

    if (currentOpen > currentClose) {
      return {
        momentum: "DOWN",
        momentumText: "增量下跌",
        momentumRatio: ratio,
      }
    }
  }

  return {
    momentum: "NONE",
    momentumText: "无明显动量",
    momentumRatio: ratio,
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getDelayToNextBoundaryWithOffset(intervalMs: number, offsetMs: number, nowMs = Date.now()) {
  const currentCycleStart = Math.floor(nowMs / intervalMs) * intervalMs
  let nextRunAt = currentCycleStart + offsetMs
  if (nextRunAt <= nowMs) {
    nextRunAt += intervalMs
  }

  return Math.max(0, nextRunAt - nowMs)
}

async function runCheck(row: VolumeAlertItem) {
  const now = new Date().toISOString()

  try {
    const payload = await getMarketCandles({
      chainIndex: row.chainIndex,
      tokenContractAddress: row.address,
      bar: row.period as GetMarketCandlesParams["bar"],
      limit: "5",
    })

    const momentumResult = analyzeMomentum(payload)
    const normalizedMomentumResult =
      !row.monitorDown && momentumResult.momentum === "DOWN"
        ? {
            ...momentumResult,
            momentum: "NONE" as const,
            momentumText: "无明显动量",
          }
        : momentumResult

    const items = await readVolumeAlertItems()
    const index = items.findIndex((item) => item.id === row.id)
    if (index < 0) {
      return
    }

    const current = items[index]
    const updated: VolumeAlertItem = {
      ...current,
      momentum: normalizedMomentumResult.momentum,
      momentumText: normalizedMomentumResult.momentumText,
      momentumRatio: normalizedMomentumResult.momentumRatio,
      lastCheckedAt: now,
    }

    items[index] = updated
    await writeVolumeAlertItems(items)

    const isSignal = updated.momentum === "UP" || updated.momentum === "DOWN"
    const shouldNotifyDown = updated.monitorDown
    const allowNotifyByDirection = updated.momentum === "UP" || (updated.momentum === "DOWN" && shouldNotifyDown)
    const isNewSignal = current.momentum !== updated.momentum

    if (isSignal && allowNotifyByDirection && isNewSignal) {
      const signal = updated.momentum === "UP" ? "UP" : "DOWN"
      await sendTelegramVolumeSignalMessage({
        signal,
        address: updated.address,
        chain: updated.chainLabel,
        period: updated.period,
        ratio: updated.momentumRatio,
      })
    }
  } catch {
    const items = await readVolumeAlertItems()
    const index = items.findIndex((item) => item.id === row.id)
    if (index < 0) {
      return
    }

    items[index] = {
      ...items[index],
      momentum: "ERROR",
      momentumText: "检测失败",
      momentumRatio: null,
      lastCheckedAt: now,
    }

    await writeVolumeAlertItems(items)
  }
}

async function runCycle() {
  if (isCycleRunning) {
    rerunRequested = true
    return
  }

  isCycleRunning = true
  try {
    const nowMs = Date.now()
    const items = await readVolumeAlertItems()
    const onlineRows = items.filter((row) => row.status === "ONLINE")

    for (const row of onlineRows) {
      const intervalMs = toPeriodMs(row.period)
      const lastCheckedMs = row.lastCheckedAt ? new Date(row.lastCheckedAt).getTime() : 0
      const shouldRun = !lastCheckedMs || nowMs - lastCheckedMs >= intervalMs
      if (!shouldRun) {
        continue
      }

      await runCheck(row)
      await sleep(REQUEST_GAP_MS)
    }
  } finally {
    isCycleRunning = false

    if (rerunRequested) {
      rerunRequested = false
      void runCycle()
    }
  }
}

export function startVolumeAlertScheduler() {
  if (started) {
    return
  }

  started = true
  const waitMs = getDelayToNextBoundaryWithOffset(GLOBAL_TICK_MS, POLL_OFFSET_MS)

  starterTimer = setTimeout(() => {
    void runCycle()
    intervalTimer = setInterval(() => {
      void runCycle()
    }, GLOBAL_TICK_MS)
  }, waitMs)
}

export function stopVolumeAlertScheduler() {
  if (starterTimer) {
    clearTimeout(starterTimer)
    starterTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
  started = false
  isCycleRunning = false
  rerunRequested = false
}
