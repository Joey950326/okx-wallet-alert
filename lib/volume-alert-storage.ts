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
  period: string
  monitorDown: boolean
  status: VolumeAlertStatus
  momentum: VolumeMomentum
  momentumText: string
  momentumRatio: number | null
  lastCheckedAt: string | null
  createdAt: string
}

export const DATA_FILE_PATH = path.join(process.cwd(), "logs", "volume-alert-items.json")

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
          typeof candidate.period !== "string" ||
          (typeof candidate.monitorDown !== "boolean" && candidate.monitorDown !== undefined) ||
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
          monitorDown: candidate.monitorDown === true,
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
          typeof candidate.monitorDown === "boolean" &&
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

export async function writeVolumeAlertItems(items: VolumeAlertItem[]) {
  await ensureDataFile()
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(items, null, 2), "utf-8")
}
