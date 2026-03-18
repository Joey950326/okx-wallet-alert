import "server-only"

import https from "node:https"

import { HttpsProxyAgent } from "https-proxy-agent"

type TelegramSendMessageResult = {
  ok: boolean
  result?: {
    message_id?: number
  }
  description?: string
}

type SendTelegramMessageInput = {
  text: string
  replyMarkup?: {
    inline_keyboard: Array<
      Array<
        | {
            text: string
            url: string
          }
        | {
            text: string
            copy_text: {
              text: string
            }
          }
      >
    >
  }
}

type SendVolumeSignalTelegramInput = {
  signal: "UP" | "DOWN"
  address: string
  chain: string
  period: string
  ratio: number | null
  maxRatio: number | null
  minRatio: number | null
}

type SendTelegramTestMessageInput = {
  address?: string
  chain?: string
}

const TELEGRAM_API_BASE_URL = "https://api.telegram.org"
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID
const TELEGRAM_PROXY_URL = process.env.TELEGRAM_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY

function buildSecuritySearchUrl(address: string) {
  const url = new URL("https://x.com/search")
  url.searchParams.set("q", `from:badattrading_ ${address}`)
  url.searchParams.set("src", "typed_query")
  url.searchParams.set("f", "top")
  return url.toString()
}

function assertTelegramCredentials() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN/TG_BOT_TOKEN or TELEGRAM_CHAT_ID/TG_CHAT_ID in .env")
  }
}

function isNetworkError(message: string) {
  return [
    "ENOTFOUND",
    "ECONNRESET",
    "ETIMEDOUT",
    "fetch failed",
    "Failed to fetch",
    "network",
  ].some((keyword) => message.toLowerCase().includes(keyword.toLowerCase()))
}

function postWithHttps(url: string, payload: string, proxyUrl?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)

    const requestOptions: https.RequestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port ? Number(target.port) : 443,
      method: "POST",
      path: `${target.pathname}${target.search}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }

    if (proxyUrl) {
      requestOptions.agent = new HttpsProxyAgent(proxyUrl)
    }

    const request = https.request(requestOptions, (response) => {
      const chunks: Buffer[] = []

      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      response.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8")
        resolve(raw)
      })
    })

    request.on("error", reject)
    request.setTimeout(30000, () => {
      request.destroy(new Error("Telegram request timeout"))
    })
    request.write(payload)
    request.end()
  })
}

export async function sendTelegramMessage(input: SendTelegramMessageInput): Promise<{ messageId?: number }> {
  assertTelegramCredentials()

  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: input.text,
    reply_markup: input.replyMarkup,
  })
  const url = `${TELEGRAM_API_BASE_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

  try {
    let payload: TelegramSendMessageResult

    if (TELEGRAM_PROXY_URL) {
      const raw = await postWithHttps(url, body, TELEGRAM_PROXY_URL)
      payload = JSON.parse(raw) as TelegramSendMessageResult
    } else {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
      })
      payload = (await response.json()) as TelegramSendMessageResult

      if (!response.ok || !payload.ok) {
        throw new Error(payload.description || `Telegram API request failed with status ${response.status}`)
      }
    }

    if (!payload.ok) {
      throw new Error(payload.description || "Telegram API returned an error")
    }

    return {
      messageId: payload.result?.message_id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram error"
    if (isNetworkError(message)) {
      throw new Error(
        "Failed to connect Telegram API (api.telegram.org). If your network requires a proxy, set TELEGRAM_PROXY_URL or HTTPS_PROXY/HTTP_PROXY."
      )
    }

    throw error instanceof Error ? error : new Error("Telegram send failed")
  }
}

export async function sendTelegramTestMessage(
  input?: SendTelegramTestMessageInput
): Promise<{ messageId?: number }> {
  const now = new Date().toLocaleString("zh-CN", { hour12: false })
  const address = input?.address?.trim()
  const chain = input?.chain?.trim()

  if (!address || !chain) {
    return sendTelegramMessage({
      text: `信号：测试电报，可忽略\n代币地址：--\n动量对比：--\n时间：${now}`,
    })
  }

  const detailUrl = `https://web3.okx.com/zh-hans/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`

  return sendTelegramMessage({
    text: `信号：测试电报，可忽略\n代币地址：${address}\n动量对比：--\n时间：${now}`,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "复制CA",
            copy_text: { text: address },
          },
          { text: "查看详情", url: detailUrl },
        ],
      ],
    },
  })
}

export async function sendTelegramVolumeSignalMessage(
  input: SendVolumeSignalTelegramInput
): Promise<{ messageId?: number }> {
  const signalLabel = input.signal === "UP" ? "增量上涨" : "增量下跌"
  const signalIcon = input.signal === "UP" ? "📈" : "📉"
  const ratioText = input.ratio && Number.isFinite(input.ratio) ? `${input.ratio.toFixed(2)}x` : "--"
  const detailUrl = `https://web3.okx.com/zh-hans/token/${encodeURIComponent(input.chain)}/${encodeURIComponent(input.address)}`
  const securityUrl = buildSecuritySearchUrl(input.address)
  const maxRatioText = input.maxRatio && Number.isFinite(input.maxRatio) ? `${(input.maxRatio * 100).toFixed(1)}%` : "--"
  const minRatioText = input.minRatio && Number.isFinite(input.minRatio) ? `${(input.minRatio * 100).toFixed(1)}%` : "--"

  return sendTelegramMessage({
    text: `🚨 量能信号提醒\n${signalIcon} 信号：${signalLabel}\n🪙 代币地址：${input.address}\n⏱️ 时间周期：${input.period}\n📊 动量对比：${ratioText}\n📈 极大值比：${maxRatioText}\n📉 极小值比：${minRatioText}`,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "复制CA",
            copy_text: { text: input.address },
          },
          { text: "安全检测", url: securityUrl },
          { text: "查看详情", url: detailUrl },
        ],
      ],
    },
  })
}
