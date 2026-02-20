export type CustomMonitorTimeLevel = "FIVE_MINUTES" | "ONE_HOUR" | "ONE_DAY"

export type CustomMonitorRow = {
  id: string
  address: string
  name: string
  marketCap: string
  price: string
  timeValue: number
  timeLevel: CustomMonitorTimeLevel
  signal: string
  signalTime: string
  createdAt: string
}

const LOCAL_STORAGE_KEY = "okx-wallet-alert.custom-monitors.v1"

const TIME_LEVEL_LABEL_MAP: Record<CustomMonitorTimeLevel, "分钟" | "小时" | "天"> = {
  FIVE_MINUTES: "分钟",
  ONE_HOUR: "小时",
  ONE_DAY: "天",
}

function isBrowser() {
  return typeof window !== "undefined"
}

function isCustomMonitorTimeLevel(value: unknown): value is CustomMonitorTimeLevel {
  return value === "FIVE_MINUTES" || value === "ONE_HOUR" || value === "ONE_DAY"
}

function toShortAddress(address: string) {
  const trimmed = address.trim()
  if (trimmed.length <= 12) {
    return trimmed
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

function createRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseRow(value: unknown): CustomMonitorRow | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const row = value as Partial<CustomMonitorRow>
  if (
    typeof row.id !== "string" ||
    typeof row.address !== "string" ||
    typeof row.name !== "string" ||
    typeof row.marketCap !== "string" ||
    typeof row.price !== "string" ||
    !isCustomMonitorTimeLevel(row.timeLevel) ||
    typeof row.signal !== "string" ||
    typeof row.signalTime !== "string" ||
    typeof row.createdAt !== "string"
  ) {
    return null
  }

  const normalizedTimeValue =
    typeof row.timeValue === "number" && Number.isFinite(row.timeValue) && row.timeValue > 0
      ? Math.floor(row.timeValue)
      : 1

  return {
    id: row.id,
    address: row.address,
    name: row.name,
    marketCap: row.marketCap,
    price: row.price,
    timeValue: normalizedTimeValue,
    timeLevel: row.timeLevel,
    signal: row.signal,
    signalTime: row.signalTime,
    createdAt: row.createdAt,
  }
}

export function getTimeLevelLabel(level: CustomMonitorTimeLevel): "分钟" | "小时" | "天" {
  return TIME_LEVEL_LABEL_MAP[level]
}

export function loadCustomMonitorRows(): CustomMonitorRow[] {
  if (!isBrowser()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => parseRow(item))
      .filter((item): item is CustomMonitorRow => item !== null)
  } catch {
    return []
  }
}

export function saveCustomMonitorRows(rows: CustomMonitorRow[]): void {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rows))
}

export function buildCustomMonitorRow(input: {
  address: string
  timeLevel: CustomMonitorTimeLevel
  timeValue: number
}): CustomMonitorRow {
  const normalizedAddress = input.address.trim()
  const normalizedTimeValue = Number.isFinite(input.timeValue) && input.timeValue > 0 ? Math.floor(input.timeValue) : 1

  return {
    id: createRowId(),
    address: normalizedAddress,
    name: toShortAddress(normalizedAddress),
    marketCap: "--",
    price: "--",
    timeValue: normalizedTimeValue,
    timeLevel: input.timeLevel,
    signal: "--",
    signalTime: "--",
    createdAt: new Date().toISOString(),
  }
}

export function removeCustomMonitorRow(rows: CustomMonitorRow[], id: string): CustomMonitorRow[] {
  return rows.filter((row) => row.id !== id)
}
