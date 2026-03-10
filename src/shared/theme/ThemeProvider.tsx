import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { themeTokens } from './tokens'
import type { ResolvedTheme, ThemeContextValue, ThemeMode } from './theme.types'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const mode: ThemeMode = 'system'
  const [theme, setTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => {
      setTheme(media.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', updateTheme)

    return () => {
      media.removeEventListener('change', updateTheme)
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      theme,
      tokens: themeTokens
    }),
    [mode, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export { ThemeContext }
