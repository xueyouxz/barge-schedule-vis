import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, themeTokens } from './tokens'
import type { ResolvedTheme, ThemeContextValue, ThemeMode } from './theme.types'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return 'light'
  }

  return mode
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE
  }

  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode
  }

  return DEFAULT_THEME_MODE
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode())
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(getInitialMode()))

  useEffect(() => {
    const resolvedTheme = resolveTheme(mode)
    setTheme(resolvedTheme)

    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.style.colorScheme = resolvedTheme
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  }, [mode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => {
      if (mode === 'system') {
        const resolvedTheme = getSystemTheme()
        setTheme(resolvedTheme)
        const root = document.documentElement
        root.dataset.theme = resolvedTheme
        root.style.colorScheme = resolvedTheme
      }
    }

    media.addEventListener('change', updateTheme)

    return () => {
      media.removeEventListener('change', updateTheme)
    }
  }, [mode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      theme,
      setMode,
      toggleTheme: () => {
        setMode(currentMode => {
          const nextBase = resolveTheme(currentMode) === 'dark' ? 'light' : 'dark'
          return nextBase
        })
      },
      tokens: themeTokens
    }),
    [mode, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export { ThemeContext }
