export const MOMENTUM_THRESHOLD_BY_PERIOD: Record<string, number> = { // 动量f阈值乘数，基于不同周期进行调整
  "15m": 3,
}

export const DEFAULT_MOMENTUM_THRESHOLD = 2 // 默认动量阈值乘数

export function getMomentumThresholdMultiplier(period: string): number {
  const normalized = period.trim().toLowerCase()
  return MOMENTUM_THRESHOLD_BY_PERIOD[normalized] ?? DEFAULT_MOMENTUM_THRESHOLD
}
