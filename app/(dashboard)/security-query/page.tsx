"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function buildSearchUrl(address: string) {
  const url = new URL("https://x.com/search")
  url.searchParams.set("q", `from:badattrading_ ${address}`)
  url.searchParams.set("src", "typed_query")
  url.searchParams.set("f", "top")
  return url.toString()
}

export default function SecurityQueryPage() {
  const [address, setAddress] = React.useState("")

  const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedAddress = address.trim()
    if (!normalizedAddress) {
      return
    }

    window.open(buildSearchUrl(normalizedAddress), "_blank")
  }, [address])

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">安全查询</h1>
          <p className="text-muted-foreground">
            输入合约地址后，跳转到 X 中 `badattrading_` 账号的相关搜索结果。
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 md:p-6">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-2">
            <label htmlFor="contract-address" className="text-sm font-medium">
              合约地址
            </label>
            <Input
              id="contract-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="请输入 address"
              autoComplete="off"
            />
          </div>

          <Button type="submit" className="w-full sm:w-auto" disabled={!address.trim()}>
            跳转
          </Button>
        </form>
      </div>
    </section>
  )
}
