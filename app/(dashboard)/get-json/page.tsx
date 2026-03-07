"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type CandlesApiResponse = {
  code: string
  msg: string
  data: unknown
}

type PeriodOption = {
  label: string
  value: string
}

type ChainOption = {
  label: string
  value: string
}

const CUSTOM_PERIOD = "custom"

const CHAIN_OPTIONS: ChainOption[] = [
  { label: "sol", value: "501" },
  { label: "bsc", value: "56" },
  { label: "eth", value: "1" },
  { label: "btc", value: "0" },
]

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1H" },
  { label: "4h", value: "4H" },
  { label: "1d", value: "1D" },
  { label: "1w", value: "1W" },
]

export default function GetJsonPage() {
  const [chainIndex, setChainIndex] = React.useState(CHAIN_OPTIONS[0]?.value ?? "503")
  const [tokenAddress, setTokenAddress] = React.useState("")
  const [periodMode, setPeriodMode] = React.useState<string>("4H")
  const [customPeriod, setCustomPeriod] = React.useState("")
  const [startTime, setStartTime] = React.useState("")
  const [endTime, setEndTime] = React.useState("")

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [resultJson, setResultJson] = React.useState<string>("")

  const resolvedPeriod = periodMode === CUSTOM_PERIOD ? customPeriod.trim() : periodMode

  const resetForm = React.useCallback(() => {
    setChainIndex(CHAIN_OPTIONS[0]?.value ?? "503")
    setTokenAddress("")
    setPeriodMode("4H")
    setCustomPeriod("")
    setStartTime("")
    setEndTime("")
    setErrorMessage(null)
    setResultJson("")
  }, [])

  const toUnixMs = React.useCallback((value: string) => {
    const date = new Date(value)
    const timestamp = date.getTime()
    return Number.isFinite(timestamp) ? timestamp : NaN
  }, [])

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setErrorMessage(null)
      setResultJson("")

      const normalizedAddress = tokenAddress.trim().toLowerCase()
      if (!normalizedAddress) {
        setErrorMessage("代币地址不能为空。")
        return
      }

      if (!resolvedPeriod) {
        setErrorMessage("请选择或输入时间周期。")
        return
      }

      let startTimestamp: number | undefined = undefined
      let endTimestamp: number | undefined = undefined

      if (startTime) {
        const v = toUnixMs(startTime)
        if (Number.isNaN(v)) {
          setErrorMessage("开始时间格式无效，请重新选择时间。")
          return
        }
        startTimestamp = v
      }

      if (endTime) {
        const v = toUnixMs(endTime)
        if (Number.isNaN(v)) {
          setErrorMessage("结束时间格式无效，请重新选择时间。")
          return
        }
        endTimestamp = v
      }

      if (startTimestamp !== undefined && endTimestamp !== undefined && startTimestamp > endTimestamp) {
        setErrorMessage("开始时间不能晚于结束时间。")
        return
      }

      const query = new URLSearchParams()
      query.set('chainIndex', chainIndex)
      query.set('tokenContractAddress', normalizedAddress)
      query.set('bar', resolvedPeriod)
      if (startTimestamp !== undefined) query.set('before', String(startTimestamp))
      if (endTimestamp !== undefined) query.set('after', String(endTimestamp))
      query.set('limit', '299')

      setIsSubmitting(true)
      try {
        const response = await fetch(`/api/okx/candles?${query.toString()}`, {
          method: "GET",
          cache: "no-store",
        })

        const payload = (await response.json()) as CandlesApiResponse

        if (!response.ok || payload.code !== "0") {
          setErrorMessage(payload.msg || "获取K线失败，请稍后重试。")
          return
        }

        setResultJson(JSON.stringify(payload, null, 2))
      } catch {
        setErrorMessage("请求失败，请检查网络或稍后重试。")
      } finally {
        setIsSubmitting(false)
      }
    },
    [chainIndex, endTime, resolvedPeriod, startTime, toUnixMs, tokenAddress]
  )

  const handleCopy = React.useCallback(async () => {
    if (!resultJson) {
      return
    }

    try {
      await navigator.clipboard.writeText(resultJson)
      window.alert("JSON 已复制到剪贴板。")
    } catch {
      window.alert("复制失败，请手动复制。")
    }
  }, [resultJson])

  const handleDownload = React.useCallback(() => {
    if (!resultJson) {
      return
    }

    const blob = new Blob([resultJson], { type: "application/json;charset=utf-8" })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = `okx-candles-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  }, [resultJson])

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">获取JSON</h1>
          <p className="text-muted-foreground">
            输入代币地址和时间范围后，调用 K 线接口并将结果导出为 JSON。
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="chain-index" className="text-sm font-medium">
              chainIndex
            </label>
            <Select value={chainIndex} onValueChange={setChainIndex}>
              <SelectTrigger id="chain-index">
                <SelectValue placeholder="请选择 chainIndex" />
              </SelectTrigger>
              <SelectContent>
                {CHAIN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="token-address" className="text-sm font-medium">
              代币地址
            </label>
            <Input
              id="token-address"
              value={tokenAddress}
              onChange={(event) => setTokenAddress(event.target.value)}
              placeholder="请输入代币地址"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="period" className="text-sm font-medium">
              时间周期
            </label>
            <Select value={periodMode} onValueChange={setPeriodMode}>
              <SelectTrigger id="period">
                <SelectValue placeholder="请选择时间周期" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_PERIOD}>自定义输入</SelectItem>
              </SelectContent>
            </Select>
            {periodMode === CUSTOM_PERIOD ? (
              <Input
                value={customPeriod}
                onChange={(event) => setCustomPeriod(event.target.value)}
                placeholder="请输入自定义周期，如 6Hutc"
                autoComplete="off"
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="start-time" className="text-sm font-medium">
              开始时间
            </label>
            <Input
              id="start-time"
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="end-time" className="text-sm font-medium">
              结束时间
            </label>
            <Input
              id="end-time"
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>

          {startTime ? (
            <p className="text-xs text-muted-foreground">开始时间戳(ms): {String(toUnixMs(startTime))}</p>
          ) : null}
          {endTime ? (
            <p className="text-xs text-muted-foreground">结束时间戳(ms): {String(toUnixMs(endTime))}</p>
          ) : null}

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "请求中..." : "确定"}
            </Button>
          </div>
        </form>
      </div>

      {resultJson ? (
        <div className="space-y-3 rounded-lg border bg-card p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">获取成功，请选择操作</h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
                复制 JSON
              </Button>
              <Button type="button" variant="outline" onClick={handleDownload}>
                下载 JSON
              </Button>
            </div>
          </div>

          <pre className="max-h-90 overflow-auto rounded-md border bg-muted p-3 text-xs leading-5">
            {resultJson}
          </pre>
        </div>
      ) : null}
    </section>
  )
}
