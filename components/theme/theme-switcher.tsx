"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useTheme } from "./theme-provider"

type ThemeSwitcherProps = {
  className?: string
  compact?: boolean
}

export function ThemeSwitcher({ className, compact = false }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          type="button"
          size="icon-sm"
          variant={theme === "light" ? "secondary" : "ghost"}
          onClick={() => setTheme("light")}
          aria-label="切换到白天主题"
        >
          <Sun />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={theme === "dark" ? "secondary" : "ghost"}
          onClick={() => setTheme("dark")}
          aria-label="切换到黑夜主题"
        >
          <Moon />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant={theme === "light" ? "secondary" : "ghost"}
        onClick={() => setTheme("light")}
      >
        <Sun />
        白天
      </Button>
      <Button
        type="button"
        size="sm"
        variant={theme === "dark" ? "secondary" : "ghost"}
        onClick={() => setTheme("dark")}
      >
        <Moon />
        黑夜
      </Button>
    </div>
  )
}
