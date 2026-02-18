"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type JingouSignalRow = {
  id: string
  time: string
  symbol: string
  marketCap: string
  signalTime: string
}

const mockRows: JingouSignalRow[] = [
  {
    id: "1",
    time: "2026-02-18 09:12:08",
    symbol: "DOGE",
    marketCap: "$17.52B",
    signalTime: "09:12:10",
  },
  {
    id: "2",
    time: "2026-02-18 09:35:26",
    symbol: "PEPE",
    marketCap: "$6.93B",
    signalTime: "09:35:30",
  },
  {
    id: "3",
    time: "2026-02-18 10:08:44",
    symbol: "BONK",
    marketCap: "$1.84B",
    signalTime: "10:08:49",
  },
]

async function fetchJingouSignals(): Promise<JingouSignalRow[]> {
  await new Promise((resolve) => setTimeout(resolve, 200))
  return mockRows
}

export default function OkxJingouPage() {
  const [rows, setRows] = React.useState<JingouSignalRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [goldEnabled, setGoldEnabled] = React.useState(true)
  const [silverEnabled, setSilverEnabled] = React.useState(true)
  const [bronzeEnabled, setBronzeEnabled] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchJingouSignals()
        if (!cancelled) {
          setRows(data)
        }
      } catch {
        if (!cancelled) {
          setError("加载失败，请稍后重试。")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const handleCopy = React.useCallback(async (symbol: string) => {
    try {
      await navigator.clipboard.writeText(symbol)
    } catch {
      window.alert("复制失败，请手动复制。")
    }
  }, [])

  const handleJump = React.useCallback((symbol: string) => {
    window.open(`https://www.okx.com/?symbol=${encodeURIComponent(symbol)}`, "_blank", "noopener,noreferrer")
  }, [])

  const columns = React.useMemo<ColumnDef<JingouSignalRow>[]>(
    () => [
      {
        accessorKey: "time",
        header: "时间",
      },
      {
        accessorKey: "symbol",
        header: "币种",
      },
      {
        accessorKey: "marketCap",
        header: "市值",
      },
      {
        accessorKey: "signalTime",
        header: "信号时间",
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => void handleCopy(row.original.symbol)}
            >
              复制
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => handleJump(row.original.symbol)}
            >
              跳转
            </Button>
          </div>
        ),
      },
    ],
    [handleCopy, handleJump]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">OKX金狗</h1>
            <p className="text-muted-foreground">
              监控金狗、银狗、铜狗信号并在下方查看最新币种触发记录。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-sm font-medium">金狗</span>
              <Switch
                checked={goldEnabled}
                onCheckedChange={setGoldEnabled}
                aria-label="切换金狗状态"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-sm font-medium">银狗</span>
              <Switch
                checked={silverEnabled}
                onCheckedChange={setSilverEnabled}
                aria-label="切换银狗状态"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-sm font-medium">铜狗</span>
              <Switch
                checked={bronzeEnabled}
                onCheckedChange={setBronzeEnabled}
                aria-label="切换铜狗状态"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => window.alert("设置功能开发中")}>
              设置
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">信号列表</h2>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
            {isLoading ? (
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
      </div>
    </section>
  )
}
