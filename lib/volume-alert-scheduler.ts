import { randomUUID } from "node:crypto"

import { fetchGemList } from "@/lib/gem-list"
import { getMarketCandles, type GetMarketCandlesParams } from "@/lib/okx-wallet"
import { getMomentumThresholdMultiplier, shouldPassExtremeRatioGuard } from "@/lib/volume-alert-config"
import { sendTelegramVolumeSignalMessage } from "@/lib/telegram-bot"
import {
  appendVolumeAlertActivityLog,
  readVolumeAlertItems,
  toAddressKey,
  toShortAddress,
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

function analyzeMomentum(candles: CandleItem[], period: string): {
  momentum: VolumeMomentum
  momentumText: string
  momentumRatio: number | null
  currentClose: number | null
} {
  if (!Array.isArray(candles) || candles.length < 3) {
    return {
      momentum: "NONE",
      momentumText: "K线不足",
      momentumRatio: null,
      currentClose: null,
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
      currentClose: null,
    }
  }

  const threshold = getMomentumThresholdMultiplier(period)
  const ratio = prevVol > 0 ? currentVol / prevVol : null

  if (currentVol >= prevVol * threshold) {
    if (currentClose > currentOpen) {
      return {
        momentum: "UP",
        momentumText: "增量上涨",
        momentumRatio: ratio,
        currentClose,
      }
    }

    if (currentOpen > currentClose) {
      return {
        momentum: "DOWN",
        momentumText: "增量下跌",
        momentumRatio: ratio,
        currentClose,
      }
    }
  }

  return {
    momentum: "NONE",
    momentumText: "无明显动量",
    momentumRatio: ratio,
    currentClose,
  }
}

function getCloseStats(candles: CandleItem[]) {
  const closeValues = candles.map((item) => Number(item.c)).filter((value) => Number.isFinite(value))
  if (!closeValues.length) {
    return {
      maxClose: null,
      minClose: null,
    }
  }

  return {
    maxClose: Math.max(...closeValues),
    minClose: Math.min(...closeValues),
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

    const momentumResult = analyzeMomentum(payload, row.period)
    const normalizedMomentumResult =
      !row.monitorDown && momentumResult.momentum === "DOWN"
        ? {
            ...momentumResult,
            momentum: "NONE" as const,
            momentumText: "无明显动量",
          }
        : momentumResult

    const closeStats = getCloseStats(payload)

    const items = await readVolumeAlertItems()
    const index = items.findIndex((item) => item.id === row.id)
    if (index < 0) {
      return
    }

    const current = items[index]
    const prevMaxClose = typeof current.maxClose === "number" ? current.maxClose : closeStats.maxClose
    const prevMinClose = typeof current.minClose === "number" ? current.minClose : closeStats.minClose
    const nextMaxClose =
      typeof closeStats.maxClose === "number"
        ? typeof current.maxClose === "number"
          ? Math.max(current.maxClose, closeStats.maxClose)
          : closeStats.maxClose
        : current.maxClose
    const nextMinClose =
      typeof closeStats.minClose === "number"
        ? typeof current.minClose === "number"
          ? Math.min(current.minClose, closeStats.minClose)
          : closeStats.minClose
        : current.minClose

    const updated: VolumeAlertItem = {
      ...current,
      momentum: normalizedMomentumResult.momentum,
      momentumText: normalizedMomentumResult.momentumText,
      momentumRatio: normalizedMomentumResult.momentumRatio,
      maxClose: nextMaxClose ?? null,
      minClose: nextMinClose ?? null,
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
      const currentClose = normalizedMomentumResult.currentClose
      const maxRatio =
        typeof currentClose === "number" && typeof prevMaxClose === "number" && prevMaxClose > 0
          ? (prevMaxClose - currentClose) / prevMaxClose
          : null
      const minRatio =
        typeof currentClose === "number" && typeof prevMinClose === "number" && prevMinClose > 0
          ? (currentClose - prevMinClose) / prevMinClose
          : null

      if (shouldPassExtremeRatioGuard({ signal, maxRatio, minRatio })) {
        await sendTelegramVolumeSignalMessage({
          signal,
          address: updated.address,
          chain: updated.chainLabel,
          period: updated.period,
          ratio: updated.momentumRatio,
          maxRatio,
          minRatio,
        })
      }
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
      maxClose: items[index].maxClose,
      minClose: items[index].minClose,
      lastCheckedAt: now,
    }

    await writeVolumeAlertItems(items)
  }
}

function parseTokenCreateTimeMs(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber)) {
      return asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber
    }

    const asDate = new Date(trimmed).getTime()
    if (Number.isFinite(asDate)) {
      return asDate
    }
  }

  return null
}

function resolvePeriodByTokenAge(tokenCreateTime: string | number | undefined): string {
  const tokenCreateMs = parseTokenCreateTimeMs(tokenCreateTime)
  if (!tokenCreateMs) {
    return "15m"
  }

  const ageHours = (Date.now() - tokenCreateMs) / (60 * 60 * 1000)
  if (ageHours > 48) {
    return "4H"
  }
  if (ageHours > 24) {
    return "1H"
  }
  return "15m"
}

async function syncGemListAfterCycle() {
  let items = await readVolumeAlertItems()
  const existingAddressKeys = new Set(items.map((item) => toAddressKey(item.address)))

  const gemList = await fetchGemList()
  let hasAdded = false

  for (const gem of gemList) {
    const addressRaw = gem.tokenInfo?.tokenContractAddress ?? ""
    const address = addressRaw.trim()
    if (!address) {
      continue
    }

    const addressKey = toAddressKey(address)
    if (existingAddressKeys.has(addressKey)) {
      continue
    }

    const period = resolvePeriodByTokenAge(gem.tokenInfo?.tokenCreateTime)
    const now = new Date().toISOString()

    let momentum: VolumeMomentum = "NONE"
    let momentumText = "待检测"
    let momentumRatio: number | null = null
    let gemMaxClose: number | null = null
    let gemMinClose: number | null = null

    try {
      const candles = await getMarketCandles({
        chainIndex: "501",
        tokenContractAddress: address,
        bar: period as GetMarketCandlesParams["bar"],
        limit: "5",
      })

      const analyzed = analyzeMomentum(candles, period)
      momentum = analyzed.momentum
      momentumText = analyzed.momentumText
      momentumRatio = analyzed.momentumRatio
      const closeStats = getCloseStats(candles)
      gemMaxClose = closeStats.maxClose
      gemMinClose = closeStats.minClose

      // Auto-added gems default monitorDown=false, so only UP signals are pushed.
      if (momentum === "UP") {
        const currentClose = analyzed.currentClose
        const maxRatio =
          typeof currentClose === "number" && typeof closeStats.maxClose === "number" && closeStats.maxClose > 0
            ? (closeStats.maxClose - currentClose) / closeStats.maxClose
            : null
        const minRatio =
          typeof currentClose === "number" && typeof closeStats.minClose === "number" && closeStats.minClose > 0
            ? (currentClose - closeStats.minClose) / closeStats.minClose
            : null

        if (shouldPassExtremeRatioGuard({ signal: "UP", maxRatio, minRatio })) {
          await sendTelegramVolumeSignalMessage({
            signal: "UP",
            address,
            chain: "solana",
            period,
            ratio: momentumRatio,
            maxRatio,
            minRatio,
          })
        }
      }
    } catch {
      momentum = "ERROR"
      momentumText = "检测失败"
      momentumRatio = null
    }

    const newItem: VolumeAlertItem = {
      id: randomUUID(),
      chainIndex: "501",
      chainLabel: "solana",
      address,
      tokenName: toShortAddress(address),
      source: "自动",
      period,
      monitorDown: false,
      status: "ONLINE",
      momentum,
      momentumText,
      momentumRatio,
      maxClose: gemMaxClose,
      minClose: gemMinClose,
      lastCheckedAt: now,
      createdAt: now,
    }

    items = [newItem, ...items]
    existingAddressKeys.add(addressKey)
    hasAdded = true

    await appendVolumeAlertActivityLog({
      action: "CREATE",
      itemId: newItem.id,
      address: newItem.address,
      detail: `from=getGemList period=${newItem.period} source=${newItem.source}`,
    })
  }

  if (hasAdded) {
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
      const currentCycleStart = Math.floor(nowMs / intervalMs) * intervalMs
      const currentCycleRunAt = currentCycleStart + POLL_OFFSET_MS
      const lastCheckedMs = row.lastCheckedAt ? new Date(row.lastCheckedAt).getTime() : 0

      // Only run after the current cycle boundary (+ offset), and at most once per cycle.
      const shouldRun = nowMs >= currentCycleRunAt && lastCheckedMs < currentCycleRunAt
      if (!shouldRun) {
        continue
      }

      await runCheck(row)
      await sleep(REQUEST_GAP_MS)
    }

    // Process OKX gems list after momentum cycle; new tokens are evaluated before insertion.
    await syncGemListAfterCycle()
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
