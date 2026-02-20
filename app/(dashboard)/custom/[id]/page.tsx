"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  getTimeLevelLabel,
  loadCustomMonitorRows,
  type CustomMonitorRow,
} from "@/lib/custom-monitor-storage"

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

export default function CustomMonitorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const idParam = params?.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam

  const [row, setRow] = React.useState<CustomMonitorRow | null>(null)
  const [isLoaded, setIsLoaded] = React.useState(false)

  React.useEffect(() => {
    if (!id) {
      setIsLoaded(true)
      return
    }

    const found = loadCustomMonitorRows().find((item) => item.id === id) ?? null
    setRow(found)
    setIsLoaded(true)
  }, [id])

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">监控详情</h1>
        <p className="text-muted-foreground">查看自定义监控项的基础信息。</p>
      </div>

      {!isLoaded ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">加载中...</div>
      ) : !row ? (
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">未找到对应监控记录，可能已被删除。</p>
          <Button type="button" variant="outline" onClick={() => router.push("/custom")}>
            返回列表
          </Button>
        </div>
      ) : (
        <div className="space-y-6 rounded-lg border bg-card p-4 md:p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">地址</dt>
              <dd className="break-all text-sm font-medium">{row.address}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">时间级别</dt>
              <dd className="text-sm font-medium">
                {row.timeValue}
                {getTimeLevelLabel(row.timeLevel)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">名称</dt>
              <dd className="text-sm font-medium">{row.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">市值</dt>
              <dd className="text-sm font-medium">{row.marketCap}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">价格</dt>
              <dd className="text-sm font-medium">{row.price}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">信号</dt>
              <dd className="text-sm font-medium">{row.signal}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">信号时间</dt>
              <dd className="text-sm font-medium">{row.signalTime}</dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">创建时间</dt>
              <dd className="text-sm font-medium">{formatDateTime(row.createdAt)}</dd>
            </div>
          </dl>

          <Button type="button" variant="outline" onClick={() => router.push("/custom")}>
            返回列表
          </Button>
        </div>
      )}
    </section>
  )
}
