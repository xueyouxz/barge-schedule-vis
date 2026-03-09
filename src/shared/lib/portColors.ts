import type { ResolvedTheme } from '@/shared/theme'

const LIGHT_PORT_COLORS = [
  '#5b8ff9',
  '#5ad8a6',
  '#5d7092',
  '#f6bd16',
  '#e8684a',
  '#6dc8ec',
  '#9270ca',
  '#ff9d4d',
  '#269a99',
  '#ff99c3',
  '#7b8cff',
  '#4caf50'
]

const DARK_PORT_COLORS = [
  '#7fb3ff',
  '#7bd88f',
  '#9ab0d3',
  '#ffd166',
  '#ff8d8d',
  '#7fd6ff',
  '#b39ddb',
  '#ffb86b',
  '#5fd1c8',
  '#ffb3d1',
  '#9aa8ff',
  '#8adf7d'
]

function hashPortId(portId: string): number {
  let hash = 0

  for (let index = 0; index < portId.length; index += 1) {
    hash = (hash << 5) - hash + portId.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function getPalette(theme: ResolvedTheme) {
  return theme === 'dark' ? DARK_PORT_COLORS : LIGHT_PORT_COLORS
}

export function resolvePortColor(portId: string, theme: ResolvedTheme): string {
  const safePortId = portId.trim()

  if (!safePortId) {
    return 'var(--chart-port-band-fallback)'
  }

  const palette = getPalette(theme)
  return palette[hashPortId(safePortId) % palette.length]
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
