"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildCustomMonitorRow,
  getTimeLevelLabel,
  loadCustomMonitorRows,
  removeCustomMonitorRow,
  saveCustomMonitorRows,
  type CustomMonitorRow,
  type CustomMonitorTimeLevel,
} from "@/lib/custom-monitor-storage"

const PAGE_SIZE = 10

const TIME_LEVEL_OPTIONS: Array<{ label: string; value: CustomMonitorTimeLevel }> = [
  { label: "分钟", value: "FIVE_MINUTES" },
  { label: "小时", value: "ONE_HOUR" },
  { label: "天", value: "ONE_DAY" },
  { label: "周", value: "ONE_WEEK" },
]

const INITIAL_FORM_STATE: { address: string; timeLevel: CustomMonitorTimeLevel; timeValue: string } = {
  address: "",
  timeLevel: "FIVE_MINUTES",
  timeValue: "1",
}

function isCustomMonitorTimeLevel(value: string): value is CustomMonitorTimeLevel {
  return TIME_LEVEL_OPTIONS.some((option) => option.value === value)
}

function normalizeAddress(address: string) {
  return address.trim().toLowerCase()
}

export default function CustomPage() {
  const router = useRouter()
  const [rows, setRows] = React.useState<CustomMonitorRow[]>([])
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [formState, setFormState] = React.useState(INITIAL_FORM_STATE)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  React.useEffect(() => {
    const storedRows = loadCustomMonitorRows()
    setRows(storedRows)
    setIsLoaded(true)
  }, [])

  const resetForm = React.useCallback(() => {
    setFormState(INITIAL_FORM_STATE)
    setFormError(null)
  }, [])

  const handleDialogOpenChange = React.useCallback(
    (open: boolean) => {
      setDialogOpen(open)
      if (!open) {
        resetForm()
      }
    },
    [resetForm]
  )

  const handleDelete = React.useCallback(
    (id: string) => {
      const confirmed = window.confirm("确定要删除这条监控记录吗？")
      if (!confirmed) {
        return
      }

      const nextRows = removeCustomMonitorRow(rows, id)
      saveCustomMonitorRows(nextRows)
      setRows(nextRows)
      setPagination((prev) => {
        const maxPageIndex = Math.max(0, Math.ceil(nextRows.length / PAGE_SIZE) - 1)
        return { ...prev, pageIndex: Math.min(prev.pageIndex, maxPageIndex) }
      })
    },
    [rows]
  )

  const handleJump = React.useCallback(
    (id: string) => {
      router.push(`/custom/${id}`)
    },
    [router]
  )

  const handleCreateSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setFormError(null)

      const address = formState.address.trim()
      if (!address) {
        setFormError("地址不能为空。")
        return
      }

      const duplicated = rows.some((row) => normalizeAddress(row.address) === normalizeAddress(address))
      if (duplicated) {
        setFormError("地址已存在，请勿重复新增。")
        return
      }

      const timeValue = Number(formState.timeValue)
      if (!Number.isInteger(timeValue) || timeValue <= 0) {
        setFormError("时间数量必须是大于 0 的整数。")
        return
      }

      const newRow = buildCustomMonitorRow({
        address,
        timeLevel: formState.timeLevel,
        timeValue,
      })
      const nextRows = [newRow, ...rows]
      saveCustomMonitorRows(nextRows)
      setRows(nextRows)
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
      setDialogOpen(false)
      resetForm()
    },
    [formState, resetForm, rows]
  )

  const COMMON_PRESETS: Array<{ label: string; value: number; level: CustomMonitorTimeLevel }> = [
    { label: "1分钟", value: 1, level: "FIVE_MINUTES" },
    { label: "5分钟", value: 5, level: "FIVE_MINUTES" },
    { label: "15分钟", value: 15, level: "FIVE_MINUTES" },
    { label: "1小时", value: 1, level: "ONE_HOUR" },
    { label: "4小时", value: 4, level: "ONE_HOUR" },
    { label: "1天", value: 1, level: "ONE_DAY" },
    { label: "1周", value: 1, level: "ONE_WEEK" },
  ]

  const columns = React.useMemo<ColumnDef<CustomMonitorRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "名称",
      },
      {
        accessorKey: "marketCap",
        header: "市值",
      },
      {
        accessorKey: "price",
        header: "价格",
      },
      {
        accessorKey: "timeLevel",
        header: "时间级别",
        cell: ({ row }) => `${row.original.timeValue}${getTimeLevelLabel(row.original.timeLevel)}`,
      },
      {
        accessorKey: "signal",
        header: "信号",
      },
      {
        accessorKey: "signalTime",
        header: "信号时间",
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="xs" variant="destructive" onClick={() => handleDelete(row.original.id)}>
              删除
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => handleJump(row.original.id)}>
              跳转
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, handleJump]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const totalPages = Math.max(1, table.getPageCount())
  const currentPage = Math.min(table.getState().pagination.pageIndex + 1, totalPages)

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">自定义监控</h1>
            <p className="text-muted-foreground">
              管理自定义地址监控项，并在下方查看列表与分页信息。
            </p>
          </div>

          <Button type="button" className="w-full md:w-auto" onClick={() => setDialogOpen(true)}>
            新增
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">监控列表</h2>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {!isLoaded ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页 · 每页 {PAGE_SIZE} 条
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增监控</DialogTitle>
            <DialogDescription>填写地址和时间周期，保存后会展示在监控表格中。</DialogDescription>
          </DialogHeader>

          <form className="mt-2 flex flex-col gap-4" onSubmit={handleCreateSubmit}>
            <div className="space-y-2">
              <label htmlFor="monitor-address" className="text-sm font-medium">
                地址
              </label>
              <Input
                id="monitor-address"
                value={formState.address}
                onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="请输入地址"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="monitor-time-value" className="text-sm font-medium">
                时间周期
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="monitor-time-value"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={formState.timeValue}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, timeValue: event.target.value }))
                  }
                  placeholder="请输入数量"
                />
                <Select
                  value={formState.timeLevel}
                  onValueChange={(value) => {
                    if (isCustomMonitorTimeLevel(value)) {
                      setFormState((prev) => ({ ...prev, timeLevel: value }))
                    }
                  }}
                >
                  <SelectTrigger id="monitor-time-level" className="w-32 shrink-0">
                    <SelectValue placeholder="单位" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {COMMON_PRESETS.map((preset) => (
                  <Button
                    key={`${preset.label}-${preset.value}`}
                    type="button"
                    size="sm"
                    variant={
                      formState.timeValue === String(preset.value) && formState.timeLevel === preset.level
                        ? "secondary"
                        : "ghost"
                    }
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, timeValue: String(preset.value), timeLevel: preset.level }))
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
