// import 'server-only'
import { createHmac } from 'node:crypto'
import dns from 'node:dns'
import { Resolver } from 'node:dns/promises'
import https from 'node:https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import {
  GetTokenInfoByAddressSchema,
  GetPriceByAddressSchema,
  GetMarketCandlesSchema,
  OkxPricePeriodSchema,
} from './schemas'

const OKX_API_BASE_URL = (process.env.OKX_API_BASE_URL || 'https://web3.okx.com').replace(/\/+$/, '')
const OKX_API_KEY = process.env.OKX_API_KEY || process.env.API_KEY
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY || process.env.SECRET_KEY
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE || process.env.PASSPHRASE
const OKX_PROJECT_ID = process.env.OKX_PROJECT_ID || process.env.OK_ACCESS_PROJECT
const OKX_PROXY_URL = process.env.OKX_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY

const TOKEN_DETAIL_PATH = '/api/v5/wallet/token/token-detail'
const HISTORICAL_PRICE_PATH = '/api/v5/wallet/token/historical-price'
const MARKET_CANDLES_PATH = '/api/v6/dex/market/candles'

import type {
  GetTokenInfoByAddressInput,
  GetPriceByAddressInput,
  GetMarketCandlesInput,
  OkxPricePeriod,
} from './schemas'

// Re-export for backward compatibility
export type GetTokenInfoByAddressParams = GetTokenInfoByAddressInput
export type GetPriceByAddressParams = GetPriceByAddressInput
export type GetMarketCandlesParams = GetMarketCandlesInput

export interface OkxTokenInfo {
  logoUrl?: string
  officialWebsite?: string
  socialUrls?: {
    twitter?: string[]
    facebook?: string[]
    reddit?: string[]
    messageboard?: string[]
    chat?: string[]
    github?: string[]
    whitepaper?: string[]
    announcement?: string[]
  }
  decimals?: string
  tokenAddress?: string
  chainIndex?: string
  chainName?: string
  symbol?: string
  name?: string
  circulatingSupply?: string
  maxSupply?: string
  totalSupply?: string
  volume24h?: string
  marketCap?: string
}

export interface OkxHistoricalPriceItem {
  time: string
  price: string
}

export interface OkxHistoricalPriceData {
  cursor?: string
  prices: OkxHistoricalPriceItem[]
}

export interface OkxMarketCandleItem {
  ts: string
  o: string
  h: string
  l: string
  c: string
  vol: string
  volUsd: string
  confirm: string
}

interface OkxResponse<T> {
  code: string
  msg: string
  data: T[]
}

interface OkxHttpResult {
  status: number
  statusText: string
  rawText: string
}

interface OkxErrorResponse {
  code?: string
  msg?: string
}

function buildOkxTimestamp(): string {
  const iso = new Date().toISOString()
  return iso.replace(/\.\d{3}Z$/, (match) => match)
}

function assertCredentials(): void {
  if (!OKX_API_KEY || !OKX_SECRET_KEY || !OKX_PASSPHRASE || !OKX_PROJECT_ID) {
    throw new Error(
      'Missing OKX credentials. Please set OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE/OKX_PROJECT_ID (or API_KEY/SECRET_KEY/PASSPHRASE/OK_ACCESS_PROJECT) in .env'
    )
  }
}

function buildRequestPath(params: GetTokenInfoByAddressParams): string {
  const search = new URLSearchParams({
    chainIndex: params.chainIndex,
    tokenAddress: params.tokenAddress ?? '',
  })

  return `${TOKEN_DETAIL_PATH}?${search.toString()}`
}

function buildHistoricalPricePath(params: GetPriceByAddressParams): string {
  const search = new URLSearchParams({
    chainIndex: params.chainIndex,
  })

  if (params.tokenAddress !== undefined) {
    search.set('tokenAddress', params.tokenAddress)
  }

  if (params.limit !== undefined) {
    search.set('limit', params.limit)
  }

  if (params.cursor !== undefined) {
    search.set('cursor', params.cursor)
  }

  if (params.begin !== undefined) {
    search.set('begin', params.begin)
  }

  if (params.end !== undefined) {
    search.set('end', params.end)
  }

  if (params.period !== undefined) {
    search.set('period', params.period)
  }

  return `${HISTORICAL_PRICE_PATH}?${search.toString()}`
}

function buildMarketCandlesPath(params: GetMarketCandlesParams): string {
  const search = new URLSearchParams({
    chainIndex: params.chainIndex,
    tokenContractAddress: params.tokenContractAddress,
  })

  if (params.after !== undefined) {
    search.set('after', params.after)
  }

  if (params.before !== undefined) {
    search.set('before', params.before)
  }

  if (params.bar !== undefined) {
    search.set('bar', params.bar)
  }

  if (params.limit !== undefined) {
    search.set('limit', params.limit)
  }

  return `${MARKET_CANDLES_PATH}?${search.toString()}`
}

function mapRawCandle(raw: string[]): OkxMarketCandleItem {
  return {
    ts: raw[0] ?? '',
    o: raw[1] ?? '',
    h: raw[2] ?? '',
    l: raw[3] ?? '',
    c: raw[4] ?? '',
    vol: raw[5] ?? '',
    volUsd: raw[6] ?? '',
    confirm: raw[7] ?? '',
  }
}

function buildSignature(timestamp: string, requestPathWithQuery: string): string {
  const prehash = `${timestamp}GET${requestPathWithQuery}`
  return createHmac('sha256', OKX_SECRET_KEY as string).update(prehash).digest('base64')
}

function buildAuthHeaders(timestamp: string, signature: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': OKX_API_KEY as string,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE as string,
    'OK-ACCESS-PROJECT': OKX_PROJECT_ID as string,
  }
}

function buildApiUrl(requestPathWithQuery: string): string {
  return `${OKX_API_BASE_URL}${requestPathWithQuery}`
}

function isNetworkError(message: string): boolean {
  return [
    'getaddrinfo',
    'ENOTFOUND',
    'ENOENT',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ECONNRESET',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'fetch failed',
  ].some((keyword) => message.includes(keyword))
}

async function resolveOkxIpv4(hostname: string): Promise<string[]> {
  const resolver = new Resolver()
  resolver.setServers(['1.1.1.1', '8.8.8.8'])

  try {
    const addresses = await resolver.resolve4(hostname)
    if (addresses.length) {
      return addresses
    }
  } catch {
    // fallback to system DNS
  }

  return await dns.promises.resolve4(hostname)
}

function requestWithDnsFallback(url: string, headers: Record<string, string>): Promise<OkxHttpResult> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)

    const requestOptions: https.RequestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port ? Number(target.port) : 443,
      method: 'GET',
      path: `${target.pathname}${target.search}`,
      headers,
      servername: target.hostname,
    }

    if (OKX_PROXY_URL) {
      requestOptions.agent = new HttpsProxyAgent(OKX_PROXY_URL)
    } else {
      requestOptions.lookup = (hostname, _options, callback) => {
        resolveOkxIpv4(hostname)
          .then((addresses) => {
            if (!addresses?.length) {
              callback(new Error(`DNS resolve4 failed for ${hostname}`), [] as dns.LookupAddress[])
              return
            }

            callback(
              null,
              addresses.map((address) => ({
                address,
                family: 4,
              }))
            )
          })
          .catch((error) => {
            callback(error as Error, [] as dns.LookupAddress[])
          })
      }
    }

    const request = https.request(
      requestOptions,
      (response) => {
        const chunks: Buffer[] = []

        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 500,
            statusText: response.statusMessage ?? '',
            rawText: Buffer.concat(chunks).toString('utf-8'),
          })
        })
      }
    )

    request.on('error', reject)
    request.end()
  })
}

async function requestWithFetch(url: string, headers: Record<string, string>): Promise<OkxHttpResult> {
  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  return {
    status: response.status,
    statusText: response.statusText,
    rawText: await response.text(),
  }
}

async function sendOkxRequest(url: string, headers: Record<string, string>): Promise<OkxHttpResult> {
  if (OKX_PROXY_URL) {
    return requestWithDnsFallback(url, headers)
  }

  try {
    return await requestWithFetch(url, headers)
  } catch (error) {
    const cause = error instanceof Error ? (error as Error & { cause?: { message?: string } }).cause : undefined
    const causeMessage = cause?.message ?? (error instanceof Error ? error.message : '')

    if (!isNetworkError(causeMessage)) {
      throw new Error(`Failed to connect OKX API${causeMessage ? `; cause=${causeMessage}` : ''}`)
    }

    return requestWithDnsFallback(url, headers)
  }
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function getTokenInfoByAddress(
  params: GetTokenInfoByAddressParams
): Promise<OkxTokenInfo | null> {
  assertCredentials()

  const timestamp = buildOkxTimestamp()
  const requestPathWithQuery = buildRequestPath(params)
  const signature = buildSignature(timestamp, requestPathWithQuery)

  const headers = buildAuthHeaders(timestamp, signature)
  const url = buildApiUrl(requestPathWithQuery)
  const { status, statusText, rawText } = await sendOkxRequest(url, headers)
  const result = parseJson<OkxResponse<OkxTokenInfo>>(rawText)
  const errorBody = parseJson<OkxErrorResponse>(rawText)

  if (status < 200 || status >= 300) {
    const upstreamMsg = errorBody ? `${errorBody.code ?? 'unknown'}: ${errorBody.msg ?? rawText}` : rawText
    throw new Error(`OKX request failed: ${status} ${statusText}; upstream=${upstreamMsg}`)
  }

  if (!result) {
    throw new Error('OKX API returned non-JSON response')
  }

  if (result.code !== '0') {
    throw new Error(`OKX API error: ${result.code}: ${result.msg || 'unknown error'}`)
  }

  return result.data[0] ?? null
}

export async function getPriceByAddress(
  params: GetPriceByAddressParams
): Promise<OkxHistoricalPriceData | null> {
  assertCredentials()

  const timestamp = buildOkxTimestamp()
  const requestPathWithQuery = buildHistoricalPricePath(params)
  const signature = buildSignature(timestamp, requestPathWithQuery)

  const headers = buildAuthHeaders(timestamp, signature)
  const url = buildApiUrl(requestPathWithQuery)
  const { status, statusText, rawText } = await sendOkxRequest(url, headers)
  const result = parseJson<OkxResponse<OkxHistoricalPriceData>>(rawText)
  const errorBody = parseJson<OkxErrorResponse>(rawText)

  if (status < 200 || status >= 300) {
    const upstreamMsg = errorBody ? `${errorBody.code ?? 'unknown'}: ${errorBody.msg ?? rawText}` : rawText
    throw new Error(`OKX request failed: ${status} ${statusText}; upstream=${upstreamMsg}`)
  }

  if (!result) {
    throw new Error('OKX API returned non-JSON response')
  }

  if (result.code !== '0') {
    throw new Error(`OKX API error: ${result.code}: ${result.msg || 'unknown error'}`)
  }

  return result.data[0] ?? null
}

export async function getMarketCandles(params: GetMarketCandlesParams): Promise<OkxMarketCandleItem[]> {
  assertCredentials()

  const timestamp = buildOkxTimestamp()
  const requestPathWithQuery = buildMarketCandlesPath(params)
  const signature = buildSignature(timestamp, requestPathWithQuery)

  const headers = buildAuthHeaders(timestamp, signature)
  const url = buildApiUrl(requestPathWithQuery)
  const { status, statusText, rawText } = await sendOkxRequest(url, headers)
  const result = parseJson<OkxResponse<string[]>>(rawText)
  const errorBody = parseJson<OkxErrorResponse>(rawText)

  if (status < 200 || status >= 300) {
    const upstreamMsg = errorBody ? `${errorBody.code ?? 'unknown'}: ${errorBody.msg ?? rawText}` : rawText
    throw new Error(`OKX request failed: ${status} ${statusText}; upstream=${upstreamMsg}`)
  }

  if (!result) {
    throw new Error('OKX API returned non-JSON response')
  }

  if (result.code !== '0') {
    throw new Error(`OKX API error: ${result.code}: ${result.msg || 'unknown error'}`)
  }

  return result.data.map(mapRawCandle)
}
