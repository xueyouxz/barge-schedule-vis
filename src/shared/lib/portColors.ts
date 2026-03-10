import type { ResolvedTheme } from '@/shared/theme'

const LIGHT_PRIMARY = '#2f6db2'
const LIGHT_SECONDARY = '#d97a1d'
const LIGHT_FALLBACK = '#9aa6b2'

const DARK_PRIMARY = '#71a7e2'
const DARK_SECONDARY = '#f29a43'
const DARK_FALLBACK = '#8c98a4'

function hashPortId(portId: string): number {
  let hash = 0

  for (let index = 0; index < portId.length; index += 1) {
    hash = (hash << 5) - hash + portId.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function getPrimary(theme: ResolvedTheme) {
  return theme === 'dark' ? DARK_PRIMARY : LIGHT_PRIMARY
}

function getSecondary(theme: ResolvedTheme) {
  return theme === 'dark' ? DARK_SECONDARY : LIGHT_SECONDARY
}

function getFallback(theme: ResolvedTheme) {
  return theme === 'dark' ? DARK_FALLBACK : LIGHT_FALLBACK
}

export function resolvePortColor(portId: string, theme: ResolvedTheme): string {
  const safePortId = portId.trim()

  if (!safePortId) {
    return getFallback(theme)
  }

  return hashPortId(safePortId) % 2 === 0 ? getPrimary(theme) : getSecondary(theme)
}

export function buildPortColorMap(portIds: Iterable<string>, theme: ResolvedTheme) {
  const entries: Array<[string, string]> = Array.from(
    new Set(
      Array.from(portIds)
        .map(portId => portId.trim())
        .filter(Boolean)
    )
  ).map(portId => [portId, resolvePortColor(portId, theme)])

  return new Map<string, string>(entries)
}
