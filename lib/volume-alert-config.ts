export const MOMENTUM_THRESHOLD_BY_PERIOD: Record<string, number> = { // 动量f阈值乘数，基于不同周期进行调整
  "15m": 3,
}

export const DEFAULT_MOMENTUM_THRESHOLD = 2 // 默认动量阈值乘数

// 默认每次获取 K 线条数。
export const DEFAULT_KLINE_FETCH_LIMIT = "100"

// 极值推送开关，默认开启。
export const EXTREME_RATIO_GUARD_ENABLED = true

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

  const maxRatio = params.maxRatio
  const minRatio = params.minRatio

  if (typeof maxRatio !== "number" || !Number.isFinite(maxRatio)) {
    return false
  }

  if (typeof minRatio !== "number" || !Number.isFinite(minRatio)) {
    return false
  }

  // 仅当极大值比或极小值比都低于阈值时，允许推送。
  return maxRatio < EXTREME_MAX_RATIO_THRESHOLD || minRatio < EXTREME_MIN_RATIO_THRESHOLD
}
