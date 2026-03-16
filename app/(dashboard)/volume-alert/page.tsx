"use client"

import * as React from "react"
import { Copy, ExternalLink, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ChainOption = {
  label: string
  value: string
}

type PeriodOption = {
  label: string
  value: string
}

type VolumeAlertStatus = "ONLINE" | "PAUSED"

type VolumeMomentum = "UP" | "DOWN" | "NONE" | "ERROR"

type VolumeAlertItem = {
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

type LegacyVolumeAlertItem = Omit<VolumeAlertItem, "status"> & {
  status: VolumeAlertStatus | "RUNNING"
}

type ApiResponse<T> = {
  code: string
  msg: string
  data: T
}

type CandleItem = {
  ts: string
  o: string
  h: string
  l: string
  c: string
  vol: string
  volUsd: string
  confirm: string
}

type CreateFormState = {
  chainIndex: string
  address: string
  periodMode: string
  customPeriod: string
  monitorDown: boolean
}

type FeedbackDialogState = {
  open: boolean
  title: string
  description: string
}

type DeleteDialogState = {
  open: boolean
  mode: "single" | "selected" | "all"
  ids: string[]
  description: string
}

type EditPeriodDialogState = {
  open: boolean
  target: VolumeAlertItem | null
  periodMode: string
  customPeriod: string
  monitorDown: boolean
  error: string | null
  isSubmitting: boolean
}

const PAGE_SIZE = 10
const CUSTOM_PERIOD = "custom"
const MAX_TOKEN_COUNT = 100

const CHAIN_OPTIONS: ChainOption[] = [
  { label: "solana", value: "501" },
  { label: "bsc", value: "56" },
  { label: "eth", value: "1" },
  { label: "btc", value: "0" },
]

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1H" },
  { label: "4h", value: "4H" },
  { label: "1d", value: "1D" },
  { label: "1w", value: "1W" },
]

const INITIAL_FORM_STATE: CreateFormState = {
  chainIndex: CHAIN_OPTIONS[0]?.value ?? "501",
  address: "",
  periodMode: "15m",
  customPeriod: "",
  monitorDown: false,
}

function normalizeAddress(value: string) {
  return value.trim()
}

function toAddressKey(value: string) {
  return value.trim().toLowerCase()
}

function buildTokenDetailUrl(chain: string, address: string) {
  return `https://web3.okx.com/zh-hans/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`
}

function buildSecuritySearchUrl(address: string) {
  const url = new URL("https://x.com/search")
  url.searchParams.set("q", `from:badattrading_ ${address}`)
  url.searchParams.set("src", "typed_query")
  url.searchParams.set("f", "top")
  return url.toString()
}

async function fetchCandles(params: {
  chainIndex: string
  address: string
  period: string
  limit: string
}): Promise<ApiResponse<CandleItem[]>> {
  const query = new URLSearchParams()
  query.set("chainIndex", params.chainIndex)
  query.set("tokenContractAddress", params.address)
  query.set("bar", params.period)
  query.set("limit", params.limit)

  const response = await fetch(`/api/okx/candles?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  })

  const payload = (await response.json()) as ApiResponse<CandleItem[]>
  if (!response.ok) {
    return {
      code: payload.code ?? String(response.status),
      msg: payload.msg ?? "请求失败",
      data: [],
    }
  }

  return payload
}

export default function VolumeAlertPage() {
  const [rows, setRows] = React.useState<VolumeAlertItem[]>([])
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [formState, setFormState] = React.useState<CreateFormState>(INITIAL_FORM_STATE)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isTestingTelegram, setIsTestingTelegram] = React.useState(false)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [addressFilter, setAddressFilter] = React.useState("")
  const [feedbackDialog, setFeedbackDialog] = React.useState<FeedbackDialogState>({
    open: false,
    title: "提示",
    description: "",
  })
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>({
    open: false,
    mode: "single",
    ids: [],
    description: "",
  })
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [editDialog, setEditDialog] = React.useState<EditPeriodDialogState>({
    open: false,
    target: null,
    periodMode: "15m",
    customPeriod: "",
    monitorDown: false,
    error: null,
    isSubmitting: false,
  })

  const openFeedbackDialog = React.useCallback((title: string, description: string) => {
    setFeedbackDialog({ open: true, title, description })
  }, [])

  const handleCopyAddress = React.useCallback(
    async (address: string) => {
      try {
        await navigator.clipboard.writeText(address)
        openFeedbackDialog("复制成功", "地址已复制到剪贴板。")
      } catch {
        openFeedbackDialog("复制失败", "复制失败，请稍后重试。")
      }
    },
    [openFeedbackDialog]
  )

  const handleJumpToDetail = React.useCallback((chain: string, address: string) => {
    const targetUrl = buildTokenDetailUrl(chain, address)
    const newTab = window.open(targetUrl, "_blank")
    if (!newTab) {
      window.location.assign(targetUrl)
    }
  }, [])

  const handleSecurityCheck = React.useCallback(() => {
    const address = formState.address.trim()
    if (!address) {
      openFeedbackDialog("提示", "请先输入代币地址。")
      return
    }

    const targetUrl = buildSecuritySearchUrl(address)
    const newTab = window.open(targetUrl, "_blank")
    if (!newTab) {
      window.location.assign(targetUrl)
    }
  }, [formState.address, openFeedbackDialog])

  const fetchRows = React.useCallback(async () => {
    try {
      const response = await fetch("/api/volume-alert", {
        method: "GET",
        cache: "no-store",
      })
      const payload = (await response.json()) as ApiResponse<LegacyVolumeAlertItem[]>

      if (!response.ok || payload.code !== "0" || !Array.isArray(payload.data)) {
        setRows([])
        return
      }

      const normalizedRows = payload.data.map((item) => ({
        ...item,
        status: item.status === "RUNNING" ? "ONLINE" : item.status,
      }))
      setRows(normalizedRows)
    } catch {
      setRows([])
    } finally {
      setIsLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  React.useEffect(() => {
    // UI polling only: refresh list from server state periodically.
    const timer = setInterval(() => {
      void fetchRows()
    }, 30 * 1000)

    return () => {
      clearInterval(timer)
    }
  }, [fetchRows])

  const resetForm = React.useCallback(() => {
    setFormState(INITIAL_FORM_STATE)
    setFormError(null)
  }, [])

  const filteredRows = React.useMemo(() => {
    const keyword = addressFilter.trim().toLowerCase()
    if (!keyword) {
      return rows
    }

    return rows.filter((row) => row.address.toLowerCase().includes(keyword))
  }, [addressFilter, rows])

  React.useEffect(() => {
    setPageIndex(0)
  }, [addressFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(pageIndex + 1, totalPages)
  const start = pageIndex * PAGE_SIZE
  const end = start + PAGE_SIZE
  const pagedRows = filteredRows.slice(start, end)
  const filteredIds = React.useMemo(() => filteredRows.map((row) => row.id), [filteredRows])
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const isAllFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id))

  React.useEffect(() => {
    const rowIds = new Set(rows.map((row) => row.id))
    setSelectedIds((prev) => prev.filter((id) => rowIds.has(id)))
  }, [rows])

  const handleDialogOpenChange = React.useCallback(
    (open: boolean) => {
      setDialogOpen(open)
      if (!open) {
        resetForm()
      }
    },
    [resetForm]
  )

  const toggleSelectItem = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev
        }
        return [...prev, id]
      }

      return prev.filter((itemId) => itemId !== id)
    })
  }, [])

  const toggleSelectAllFiltered = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])))
        return
      }

      const filteredIdSet = new Set(filteredIds)
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)))
    },
    [filteredIds]
  )

  const handleDelete = React.useCallback((item: VolumeAlertItem) => {
    setDeleteDialog({
      open: true,
      mode: "single",
      ids: [item.id],
      description: `确定删除 ${item.tokenName} 的量能通知吗？`,
    })
  }, [])

  const handleDeleteAll = React.useCallback(() => {
    if (!rows.length) {
      openFeedbackDialog("提示", "当前没有可删除的代币。")
      return
    }

    setDeleteDialog({
      open: true,
      mode: "all",
      ids: rows.map((row) => row.id),
      description: `确定一键删除全部 ${rows.length} 个代币吗？`,
    })
  }, [openFeedbackDialog, rows])

  const handleDeleteSelected = React.useCallback(() => {
    if (!selectedIds.length) {
      openFeedbackDialog("提示", "请先选择要删除的代币。")
      return
    }

    setDeleteDialog({
      open: true,
      mode: "selected",
      ids: selectedIds,
      description: `确定删除已选中的 ${selectedIds.length} 个代币吗？`,
    })
  }, [openFeedbackDialog, selectedIds])

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog.ids.length || isDeleting) {
      return
    }

    setIsDeleting(true)
    try {
      const query =
        deleteDialog.mode === "all"
          ? "all=1"
          : `ids=${encodeURIComponent(deleteDialog.ids.join(","))}`

      const response = await fetch(`/api/volume-alert?${query}`, {
        method: "DELETE",
      })
      const payload = (await response.json()) as ApiResponse<{ deletedCount?: number } | null>

      if (!response.ok || payload.code !== "0") {
        openFeedbackDialog("删除失败", payload.msg || "删除失败")
        return
      }

      const deleteSet = new Set(deleteDialog.ids)
      const nextRows = deleteDialog.mode === "all" ? [] : rows.filter((row) => !deleteSet.has(row.id))
      setRows(nextRows)
      setSelectedIds((prev) => prev.filter((id) => !deleteSet.has(id)))
      setPageIndex((prev) => {
        const maxPageIndex = Math.max(0, Math.ceil(nextRows.length / PAGE_SIZE) - 1)
        return Math.min(prev, maxPageIndex)
      })
      setDeleteDialog((prev) => ({ ...prev, open: false, ids: [] }))
      openFeedbackDialog("删除成功", `已删除 ${deleteDialog.ids.length} 条记录。`)
    } catch {
      openFeedbackDialog("删除失败", "删除失败，请稍后重试")
    } finally {
      setIsDeleting(false)
    }
  }, [deleteDialog, isDeleting, openFeedbackDialog, rows])

  const handleTogglePause = React.useCallback(
    async (id: string) => {
      try {
        const response = await fetch("/api/volume-alert", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "togglePause" }),
        })

        const payload = (await response.json()) as ApiResponse<VolumeAlertItem>
        if (!response.ok || payload.code !== "0" || !payload.data) {
          openFeedbackDialog("更新失败", payload.msg || "更新失败")
          return
        }

        setRows((prev) => prev.map((row) => (row.id === id ? payload.data : row)))
      } catch {
        openFeedbackDialog("更新失败", "更新失败，请稍后重试")
      }
    },
    [openFeedbackDialog]
  )

  const openEditDialog = React.useCallback((item: VolumeAlertItem) => {
    const matched = PERIOD_OPTIONS.find((option) => option.value === item.period)
    setEditDialog({
      open: true,
      target: item,
      periodMode: matched ? matched.value : CUSTOM_PERIOD,
      customPeriod: matched ? "" : item.period,
      monitorDown: item.monitorDown,
      error: null,
      isSubmitting: false,
    })
  }, [])

  const handleEditDialogOpenChange = React.useCallback((open: boolean) => {
    setEditDialog((prev) => ({
      ...prev,
      open,
      error: open ? prev.error : null,
    }))
  }, [])

  const handleEditPeriodSubmit = React.useCallback(async () => {
    if (!editDialog.target || editDialog.isSubmitting) {
      return
    }

    const nextPeriod =
      editDialog.periodMode === CUSTOM_PERIOD ? editDialog.customPeriod.trim() : editDialog.periodMode
    if (!nextPeriod) {
      setEditDialog((prev) => ({ ...prev, error: "请选择或输入时间周期。" }))
      return
    }

    setEditDialog((prev) => ({ ...prev, isSubmitting: true, error: null }))
    try {
      const response = await fetch("/api/volume-alert", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editDialog.target.id,
          action: "updateConfig",
          period: nextPeriod,
          monitorDown: editDialog.monitorDown,
        }),
      })

      const payload = (await response.json()) as ApiResponse<VolumeAlertItem>
      if (!response.ok || payload.code !== "0" || !payload.data) {
        setEditDialog((prev) => ({ ...prev, isSubmitting: false, error: payload.msg || "更新失败" }))
        return
      }

      setRows((prev) => prev.map((row) => (row.id === payload.data.id ? payload.data : row)))
      setEditDialog((prev) => ({ ...prev, open: false, isSubmitting: false, error: null }))
      openFeedbackDialog("更新成功", "时间周期已更新。")
    } catch {
      setEditDialog((prev) => ({ ...prev, isSubmitting: false, error: "更新失败，请稍后重试" }))
    }
  }, [editDialog, openFeedbackDialog])

  const handleTestTelegram = React.useCallback(async () => {
    if (isTestingTelegram) {
      return
    }

    setIsTestingTelegram(true)
    try {
      const firstRow = rows[0]
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: firstRow?.address,
          chain: firstRow?.chainLabel,
        }),
      })
      const payload = (await response.json()) as ApiResponse<{ messageId?: number } | null>

      if (!response.ok || payload.code !== "0") {
        openFeedbackDialog("测试电报失败", payload.msg || "测试电报失败")
        return
      }

      openFeedbackDialog("测试电报成功", "测试电报发送成功")
    } catch {
      openFeedbackDialog("测试电报失败", "测试电报失败，请稍后重试")
    } finally {
      setIsTestingTelegram(false)
    }
  }, [isTestingTelegram, openFeedbackDialog, rows])

  const resolvedPeriod =
    formState.periodMode === CUSTOM_PERIOD ? formState.customPeriod.trim() : formState.periodMode

  const handleCreateSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setFormError(null)

      const address = normalizeAddress(formState.address)
      if (!address) {
        setFormError("地址不能为空。")
        return
      }

      if (!resolvedPeriod) {
        setFormError("请选择或输入时间周期。")
        return
      }

      const duplicated = rows.some((row) => toAddressKey(row.address) === toAddressKey(address))
      if (duplicated) {
        setFormError("代币已存在")
        openFeedbackDialog("新增失败", "代币已存在")
        return
      }

      if (rows.length >= MAX_TOKEN_COUNT) {
        setFormError(`最多只支持添加 ${MAX_TOKEN_COUNT} 个代币。`)
        openFeedbackDialog("新增失败", `最多只支持添加 ${MAX_TOKEN_COUNT} 个代币。`)
        return
      }

      setIsSubmitting(true)
      try {
        const candlesPayload = await fetchCandles({
          chainIndex: formState.chainIndex,
          address,
          period: resolvedPeriod,
          limit: "2",
        })

        if (candlesPayload.code !== "0" || !Array.isArray(candlesPayload.data) || candlesPayload.data.length === 0) {
          setFormError(candlesPayload.msg || "调用 /api/okx/candles 失败")
          openFeedbackDialog("添加失败", "未获取到有效K线数据")
          return
        }

        const selectedChain = CHAIN_OPTIONS.find((option) => option.value === formState.chainIndex)
        const response = await fetch("/api/volume-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainIndex: formState.chainIndex,
            chainLabel: selectedChain?.label ?? "unknown",
            address,
            period: resolvedPeriod,
            monitorDown: formState.monitorDown,
          }),
        })
        const payload = (await response.json()) as ApiResponse<VolumeAlertItem>

        if (!response.ok || payload.code !== "0" || !payload.data) {
          setFormError(payload.msg || "添加失败")
          openFeedbackDialog("添加失败", payload.msg || "添加失败")
          return
        }

        setRows((prev) => [payload.data, ...prev])
        setPageIndex(0)
        setDialogOpen(false)
        resetForm()
        openFeedbackDialog("添加成功", "量能通知已创建并开始轮询。")
      } catch {
        setFormError("请求失败，请稍后重试。")
        openFeedbackDialog("添加失败", "添加失败，请稍后重试")
      } finally {
        setIsSubmitting(false)
      }
    },
    [formState, openFeedbackDialog, resetForm, resolvedPeriod, rows]
  )

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">量能通知</h1>
          <p className="text-muted-foreground">配置代币量能监控，系统会按时间周期自动检测增量上涨/下跌。</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">功能区</h2>
            <p className={`text-xs ${rows.length >= MAX_TOKEN_COUNT ? "text-destructive" : "text-muted-foreground"}`}>
              已添加 {rows.length}/{MAX_TOKEN_COUNT}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Button type="button" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              增加
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => void handleTestTelegram()}
              disabled={isTestingTelegram}
            >
              {isTestingTelegram ? "发送中..." : "测试电报"}
            </Button>
            <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={() => handleDeleteSelected()}>
              删除已选 ({selectedIds.length})
            </Button>
            <Button type="button" className="w-full sm:w-auto" variant="destructive" onClick={() => handleDeleteAll()}>
              一键删除
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">表格区</h2>
          <div className="w-full md:w-80">
            <Input
              value={addressFilter}
              onChange={(event) => setAddressFilter(event.target.value)}
              placeholder="按地址筛选"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {!isLoaded ? (
            <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">加载中...</div>
          ) : pagedRows.length ? (
            pagedRows.map((row) => (
              <article key={row.id} className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4"
                      checked={selectedIdSet.has(row.id)}
                      onChange={(event) => toggleSelectItem(row.id, event.target.checked)}
                      aria-label={`选择 ${row.address}`}
                    />
                    <p className="font-mono text-xs break-all">{row.address}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void handleCopyAddress(row.address)}
                    aria-label="复制地址"
                    title="复制地址"
                  >
                    <Copy />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="text-muted-foreground">周期</p>
                  <p className="text-right">{row.period}</p>
                  <p className="text-muted-foreground">状态</p>
                  <p className="text-right">{row.status === "ONLINE" ? "在线" : "暂停"}</p>
                </div>
                <div className="text-xs space-y-1">
                  <p>{row.momentumText}</p>
                  {typeof row.momentumRatio === "number" ? (
                    <p className="text-muted-foreground">动量对比: {row.momentumRatio.toFixed(2)}x</p>
                  ) : null}
                  {row.lastCheckedAt ? (
                    <p className="text-muted-foreground">{new Date(row.lastCheckedAt).toLocaleString()}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="xs" variant="outline" onClick={() => openEditDialog(row)}>
                    <Pencil />编辑
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => handleJumpToDetail(row.chainLabel, row.address)}
                  >
                    <ExternalLink />跳转
                  </Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => void handleTogglePause(row.id)}>
                    {row.status === "ONLINE" ? "暂停" : "恢复"}
                  </Button>
                  <Button type="button" size="xs" variant="destructive" onClick={() => handleDelete(row)}>
                    删除
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
              {filteredRows.length ? "当前页暂无数据" : "暂无数据"}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={isAllFilteredSelected}
                    onChange={(event) => toggleSelectAllFiltered(event.target.checked)}
                    aria-label="全选当前筛选结果"
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap">地址</TableHead>
                <TableHead className="whitespace-nowrap">时间周期</TableHead>
                <TableHead className="whitespace-nowrap">最新信息</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoaded ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : pagedRows.length ? (
                pagedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={selectedIdSet.has(row.id)}
                        onChange={(event) => toggleSelectItem(row.id, event.target.checked)}
                        aria-label={`选择 ${row.address}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="max-w-72 truncate font-mono text-xs" title={`${row.chainLabel}: ${row.address}`}>
                          {row.address}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void handleCopyAddress(row.address)}
                          aria-label="复制地址"
                          title="复制地址"
                        >
                          <Copy />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.period}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{row.momentumText}</span>
                        {typeof row.momentumRatio === "number" ? (
                          <span className="text-xs text-muted-foreground">动量对比: {row.momentumRatio.toFixed(2)}x</span>
                        ) : null}
                        {row.lastCheckedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(row.lastCheckedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.status === "ONLINE" ? "在线" : "暂停"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          onClick={() => handleDelete(row)}
                        >
                          删除
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => openEditDialog(row)}
                        >
                          <Pencil />
                          编辑
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => handleJumpToDetail(row.chainLabel, row.address)}
                        >
                          <ExternalLink />
                          跳转
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => void handleTogglePause(row.id)}
                        >
                          {row.status === "ONLINE" ? "暂停" : "恢复"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {filteredRows.length ? "当前页暂无数据" : "暂无数据"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页 · 每页 {PAGE_SIZE} 条
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={pageIndex <= 0}
            >
              上一页
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={pageIndex >= totalPages - 1}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>增加表单</DialogTitle>
            <DialogDescription>请填写主链、地址和时间周期，保存后将开启自动动量检测。</DialogDescription>
          </DialogHeader>

          <form className="mt-2 flex flex-col gap-4" onSubmit={(event) => void handleCreateSubmit(event)}>
            <div className="space-y-2">
              <label htmlFor="volume-chain-index" className="text-sm font-medium">
                主链
              </label>
              <Select
                value={formState.chainIndex}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, chainIndex: value }))}
              >
                <SelectTrigger id="volume-chain-index">
                  <SelectValue placeholder="请选择主链" />
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
              <label htmlFor="volume-address" className="text-sm font-medium">
                地址
              </label>
              <Input
                id="volume-address"
                value={formState.address}
                onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="请输入代币地址"
                autoComplete="off"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleSecurityCheck}
                  disabled={!formState.address.trim()}
                >
                  安全检测
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="volume-period-mode" className="text-sm font-medium">
                时间周期
              </label>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                <Select
                  value={formState.periodMode}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, periodMode: value }))}
                >
                  <SelectTrigger id="volume-period-mode">
                    <SelectValue placeholder="请选择时间周期" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_PERIOD}>自定义</SelectItem>
                  </SelectContent>
                </Select>

                {formState.periodMode === CUSTOM_PERIOD ? (
                  <Input
                    id="volume-custom-period"
                    value={formState.customPeriod}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, customPeriod: event.target.value }))
                    }
                    placeholder="输入自定义周期，如 2H"
                  />
                ) : (
                  <Input value={formState.periodMode} disabled readOnly aria-label="已选时间周期" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">下跌动量监控</p>
                <p className="text-xs text-muted-foreground">开启后会计算并通知“增量下跌”信号。</p>
              </div>
              <Switch
                checked={formState.monitorDown}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    monitorDown: checked,
                  }))
                }
                aria-label="下跌动量监控"
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "校验中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog.open} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑时间周期</DialogTitle>
            <DialogDescription>
              {editDialog.target ? `修改 ${editDialog.target.address} 的时间周期。` : "修改时间周期。"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-volume-period-mode" className="text-sm font-medium">
                时间周期
              </label>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                <Select
                  value={editDialog.periodMode}
                  onValueChange={(value) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      periodMode: value,
                      error: null,
                    }))
                  }
                >
                  <SelectTrigger id="edit-volume-period-mode">
                    <SelectValue placeholder="请选择时间周期" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_PERIOD}>自定义</SelectItem>
                  </SelectContent>
                </Select>

                {editDialog.periodMode === CUSTOM_PERIOD ? (
                  <Input
                    id="edit-volume-custom-period"
                    value={editDialog.customPeriod}
                    onChange={(event) =>
                      setEditDialog((prev) => ({
                        ...prev,
                        customPeriod: event.target.value,
                        error: null,
                      }))
                    }
                    placeholder="输入自定义周期，如 2H"
                  />
                ) : (
                  <Input value={editDialog.periodMode} disabled readOnly aria-label="已选时间周期" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">下跌动量监控</p>
                <p className="text-xs text-muted-foreground">开启后会计算并通知“增量下跌”信号。</p>
              </div>
              <Switch
                checked={editDialog.monitorDown}
                onCheckedChange={(checked) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    monitorDown: checked,
                    error: null,
                  }))
                }
                aria-label="编辑下跌动量监控"
              />
            </div>

            {editDialog.error ? <p className="text-sm text-destructive">{editDialog.error}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleEditDialogOpenChange(false)}
                disabled={editDialog.isSubmitting}
              >
                取消
              </Button>
              <Button type="button" onClick={() => void handleEditPeriodSubmit()} disabled={editDialog.isSubmitting}>
                {editDialog.isSubmitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog((prev) => ({
            ...prev,
            open,
          }))
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
            <DialogDescription>{deleteDialog.description || "确定执行删除操作吗？"}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteDialog((prev) => ({
                  ...prev,
                  open: false,
                }))
              }
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleConfirmDelete()} disabled={isDeleting}>
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={feedbackDialog.open}
        onOpenChange={(open) =>
          setFeedbackDialog((prev) => ({
            ...prev,
            open,
          }))
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{feedbackDialog.title}</DialogTitle>
            <DialogDescription>{feedbackDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() =>
                setFeedbackDialog((prev) => ({
                  ...prev,
                  open: false,
                }))
              }
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
