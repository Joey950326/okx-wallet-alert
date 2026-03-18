export const MOMENTUM_THRESHOLD_BY_PERIOD: Record<string, number> = { // 动量f阈值乘数，基于不同周期进行调整
  "15m": 3,
}

export const DEFAULT_MOMENTUM_THRESHOLD = 2 // 默认动量阈值乘数

// 极值推送开关，默认关闭。
export const EXTREME_RATIO_GUARD_ENABLED = false

// 极值比阈值，默认 25%（0.25）。
export const EXTREME_MAX_RATIO_THRESHOLD = 0.25
export const EXTREME_MIN_RATIO_THRESHOLD = 0.25

export function getMomentumThresholdMultiplier(period: string): number {
  const normalized = period.trim().toLowerCase()
  return MOMENTUM_THRESHOLD_BY_PERIOD[normalized] ?? DEFAULT_MOMENTUM_THRESHOLD
}

export function shouldPassExtremeRatioGuard(params: {
  signal: "UP" | "DOWN"
  maxRatio: number | null
  minRatio: number | null
}) {
  if (!EXTREME_RATIO_GUARD_ENABLED) {
    return true
  }

  if (params.signal === "UP") {
    return typeof params.maxRatio === "number" && Number.isFinite(params.maxRatio) && params.maxRatio < EXTREME_MAX_RATIO_THRESHOLD
  }

  return typeof params.minRatio === "number" && Number.isFinite(params.minRatio) && params.minRatio < EXTREME_MIN_RATIO_THRESHOLD
}
