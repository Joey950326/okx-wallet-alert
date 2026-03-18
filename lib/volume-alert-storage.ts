import { promises as fs } from "node:fs"
import path from "node:path"

export type VolumeAlertStatus = "ONLINE" | "PAUSED"

export type VolumeMomentum = "UP" | "DOWN" | "NONE" | "ERROR"

export type VolumeAlertItem = {
  id: string
  chainIndex: string
  chainLabel: string
  address: string
  tokenName: string
  source: string
  period: string
  monitorDown: boolean
  status: VolumeAlertStatus
  momentum: VolumeMomentum
  momentumText: string
  momentumRatio: number | null
  maxClose: number | null
  minClose: number | null
  lastCheckedAt: string | null
  createdAt: string
}

export const DATA_FILE_PATH = path.join(process.cwd(), "logs", "volume-alert-items.json")
const ACTIVITY_LOG_FILE_PATH = path.join(process.cwd(), "logs", "volume-alert-activity.log")

export function normalizeAddress(value: string) {
  return value.trim()
}

export function toAddressKey(value: string) {
  return value.trim().toLowerCase()
}

export function toShortAddress(address: string) {
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

async function ensureActivityLogFile() {
  const directory = path.dirname(ACTIVITY_LOG_FILE_PATH)
  await fs.mkdir(directory, { recursive: true })

  try {
    await fs.access(ACTIVITY_LOG_FILE_PATH)
  } catch {
    await fs.writeFile(ACTIVITY_LOG_FILE_PATH, "", "utf-8")
  }
}

export async function appendVolumeAlertActivityLog(entry: {
  action: "CREATE" | "UPDATE" | "DELETE"
  itemId?: string
  address?: string
  detail?: string
}) {
  await ensureActivityLogFile()
  const payload = {
    at: new Date().toISOString(),
    ...entry,
  }

  await fs.appendFile(ACTIVITY_LOG_FILE_PATH, `${JSON.stringify(payload)}\n`, "utf-8")
}

export async function readVolumeAlertItems(): Promise<VolumeAlertItem[]> {
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
          (typeof candidate.source !== "string" && candidate.source !== undefined) ||
          typeof candidate.period !== "string" ||
          (typeof candidate.monitorDown !== "boolean" && candidate.monitorDown !== undefined) ||
          (candidate.momentum !== "UP" &&
            candidate.momentum !== "DOWN" &&
            candidate.momentum !== "NONE" &&
            candidate.momentum !== "ERROR") ||
          typeof candidate.momentumText !== "string" ||
          (typeof candidate.momentumRatio !== "number" && candidate.momentumRatio !== null && candidate.momentumRatio !== undefined) ||
          (typeof candidate.maxClose !== "number" && candidate.maxClose !== null && candidate.maxClose !== undefined) ||
          (typeof candidate.minClose !== "number" && candidate.minClose !== null && candidate.minClose !== undefined) ||
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
          source: typeof candidate.source === "string" && candidate.source.trim() ? candidate.source : "手动",
          period: candidate.period,
          monitorDown: candidate.monitorDown === true,
          status: normalizedStatus,
          momentum: candidate.momentum,
          momentumText: candidate.momentumText,
          momentumRatio:
            typeof candidate.momentumRatio === "number" && Number.isFinite(candidate.momentumRatio)
              ? candidate.momentumRatio
              : null,
          maxClose:
            typeof candidate.maxClose === "number" && Number.isFinite(candidate.maxClose)
              ? candidate.maxClose
              : null,
          minClose:
            typeof candidate.minClose === "number" && Number.isFinite(candidate.minClose)
              ? candidate.minClose
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
          typeof candidate.source === "string" &&
          typeof candidate.period === "string" &&
          typeof candidate.monitorDown === "boolean" &&
          (candidate.status === "ONLINE" || candidate.status === "PAUSED") &&
          (candidate.momentum === "UP" ||
            candidate.momentum === "DOWN" ||
            candidate.momentum === "NONE" ||
            candidate.momentum === "ERROR") &&
          typeof candidate.momentumText === "string" &&
          (typeof candidate.momentumRatio === "number" || candidate.momentumRatio === null) &&
          (typeof candidate.maxClose === "number" || candidate.maxClose === null) &&
          (typeof candidate.minClose === "number" || candidate.minClose === null) &&
          (typeof candidate.lastCheckedAt === "string" || candidate.lastCheckedAt === null) &&
          typeof candidate.createdAt === "string"
        )
      })
  } catch {
    return []
  }
}

export async function writeVolumeAlertItems(items: VolumeAlertItem[]) {
  await ensureDataFile()
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(items, null, 2), "utf-8")
}
