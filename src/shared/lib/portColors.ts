import type { ResolvedTheme } from '@/shared/theme'

// Keep this palette manually aligned with the core chart colors in variables.css,
// especially --chart-load, --chart-unload, and related semantic accents.
const LIGHT_PORT_PALETTE = [
  '#2f6db2',
  '#d97a1d',
  '#8a949e',
  '#2f855a',
  '#c05621',
  '#0f766e',
  '#7c3aed',
  '#b7791f',
  '#00838f',
  '#b83280'
] as const
const LIGHT_FALLBACK = '#9aa6b2'

const DARK_PORT_PALETTE = [
  '#71a7e2',
  '#f29a43',
  '#808c97',
  '#68d391',
  '#f6ad55',
  '#4fd1c5',
  '#b794f4',
  '#f6e05e',
  '#63b3ed',
  '#f687b3'
] as const
const DARK_FALLBACK = '#8c98a4'

function hashPortId(portId: string): number {
  let hash = 0

  for (let index = 0; index < portId.length; index += 1) {
    hash = (hash << 5) - hash + portId.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function getPalette(theme: ResolvedTheme) {
  return theme === 'dark' ? DARK_PORT_PALETTE : LIGHT_PORT_PALETTE
}

function getFallback(theme: ResolvedTheme) {
  return theme === 'dark' ? DARK_FALLBACK : LIGHT_FALLBACK
}

export function resolvePortColor(portId: string, theme: ResolvedTheme): string {
  const safePortId = portId.trim()

  if (!safePortId) {
    return getFallback(theme)
  }

  const palette = getPalette(theme)
  return palette[hashPortId(safePortId) % palette.length] ?? getFallback(theme)
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
