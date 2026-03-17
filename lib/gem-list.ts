import https from "node:https"

import { HttpsProxyAgent } from "https-proxy-agent"

export type GemTokenInfo = {
  tokenContractAddress?: string
  tokenCreateTime?: string | number
}

export type GemItem = {
  tokenInfo?: GemTokenInfo
}

const GEM_LIST_URL =
  "https://web3.okx.com/priapi/v1/dx/market/v2/smartmoney/signal/gems-list?sortBy=4&isAsc=true&signalLabels=1%2C2%2C3&chainId=501"

const GEM_LIST_PROXY_URL = process.env.OKX_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY

async function requestGemListRaw(): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = new URL(GEM_LIST_URL)

    const request = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port ? Number(target.port) : 443,
        method: "GET",
        path: `${target.pathname}${target.search}`,
        headers: {
          "Content-Type": "application/json",
        },
        ...(GEM_LIST_PROXY_URL ? { agent: new HttpsProxyAgent(GEM_LIST_PROXY_URL) } : {}),
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8")
          const status = response.statusCode ?? 500
          if (status < 200 || status >= 300) {
            reject(new Error(`getGemList request failed: ${status}`))
            return
          }
          resolve(raw)
        })
      }
    )

    request.on("error", reject)
    request.end()
  })
}

export async function fetchGemList(): Promise<GemItem[]> {
  const raw = await requestGemListRaw()
  const payload = JSON.parse(raw) as unknown
  if (!payload || typeof payload !== "object") {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (!data || typeof data !== "object") {
    return []
  }

  const maybeGemList = (data as { gems?: unknown; gemList?: unknown }).gems
  const fallbackGemList = (data as { gems?: unknown; gemList?: unknown }).gemList
  const list = Array.isArray(maybeGemList) ? maybeGemList : fallbackGemList

  if (!Array.isArray(list)) {
    return []
  }

  return list as GemItem[]
}
