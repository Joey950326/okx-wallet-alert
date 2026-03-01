"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type NavItem = {
  title: string
  href: "/okx-jingou" | "/custom" | "/get-json"
}

const navItems: NavItem[] = [
  { title: "OKX金狗", href: "/okx-jingou" },
  { title: "自定义", href: "/custom" },
  { title: "获取JSON", href: "/get-json" },
]

type SidebarNavProps = {
  className?: string
  onNavigate?: () => void
}

export function SidebarNav({ className, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive = pathname === item.href

        return (
          <Button
            key={item.href}
            asChild
            variant={isActive ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <Link href={item.href} onClick={onNavigate}>
              {item.title}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
