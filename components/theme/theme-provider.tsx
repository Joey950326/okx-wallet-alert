"use client"

import * as React from "react"

const THEME_STORAGE_KEY = "okx-wallet-alert-theme"

export type Theme = "light" | "dark"

type ThemeProviderValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeProviderValue | null>(null)

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark"
}

function getInitialTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") {
    return defaultTheme
  }

  try {
    if (document.documentElement.classList.contains("dark")) {
      return "dark"
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(savedTheme)) {
      return savedTheme
    }
  } catch {
    return defaultTheme
  }

  return defaultTheme
}

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => getInitialTheme(defaultTheme))

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const value = React.useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
