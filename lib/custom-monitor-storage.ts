import { CustomMonitorRow, CustomMonitorTimeLevel, CustomMonitorRowSchema, BuildCustomMonitorInputSchema, CustomMonitorTimeLevelSchema } from './schemas'

export type { CustomMonitorRow, CustomMonitorTimeLevel }

const LOCAL_STORAGE_KEY = "okx-wallet-alert.custom-monitors.v1"

const TIME_LEVEL_LABEL_MAP: Record<CustomMonitorTimeLevel, "分钟" | "小时" | "天" | "周"> = {
  FIVE_MINUTES: "分钟",
  ONE_HOUR: "小时",
  ONE_DAY: "天",
  ONE_WEEK: "周",
}

function isBrowser() {
  return typeof window !== "undefined"
}

function isCustomMonitorTimeLevel(value: unknown): value is CustomMonitorTimeLevel {
  return CustomMonitorTimeLevelSchema.safeParse(value).success
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
  // First validate basic structure
  const result = CustomMonitorRowSchema.safeParse(value)
  if (!result.success) {
    return null
  }

  const row = result.data
  const normalizedTimeValue =
    Number.isFinite(row.timeValue) && row.timeValue > 0 ? Math.floor(row.timeValue) : 1

  return {
    ...row,
    timeValue: normalizedTimeValue,
  }
}

export function getTimeLevelLabel(level: CustomMonitorTimeLevel): "分钟" | "小时" | "天" | "周" {
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
  // Validate input using schema
  const validated = BuildCustomMonitorInputSchema.parse(input)

  const normalizedTimeValue =
    Number.isFinite(validated.timeValue) && validated.timeValue > 0
      ? Math.floor(validated.timeValue)
      : 1

  return {
    id: createRowId(),
    address: validated.address,
    name: toShortAddress(validated.address),
    marketCap: "--",
    price: "--",
    timeValue: normalizedTimeValue,
    timeLevel: validated.timeLevel,
    signal: "--",
    signalTime: "--",
    createdAt: new Date().toISOString(),
  }
}

export function removeCustomMonitorRow(rows: CustomMonitorRow[], id: string): CustomMonitorRow[] {
  return rows.filter((row) => row.id !== id)
}
