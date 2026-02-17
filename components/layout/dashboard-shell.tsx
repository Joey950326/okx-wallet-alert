"use client"

import * as React from "react"
import { Menu } from "lucide-react"

import { SidebarNav } from "@/components/layout/sidebar-nav"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type DashboardShellProps = {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-sidebar md:flex md:flex-col">
        <div className="border-b px-4 py-4">
          <p className="text-sm font-semibold tracking-wide">OKX Wallet Alert</p>
        </div>
        <div className="flex-1 p-2">
          <SidebarNav />
        </div>
        <div className="border-t p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">主题</p>
          <ThemeSwitcher />
        </div>
      </aside>

      <div className="flex flex-col bg-background">
        <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Open navigation menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0">
              <SheetHeader className="border-b px-4 py-4 text-left">
                <SheetTitle>OKX Wallet Alert</SheetTitle>
              </SheetHeader>
              <div className="p-2">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <p className="text-sm font-semibold tracking-wide">OKX Wallet Alert</p>
          <ThemeSwitcher compact />
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
