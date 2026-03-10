export function withAlpha(hexColor: string, alpha = 0.25): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#')) return hexColor

  const hex = normalized.slice(1)
  const isShort = hex.length === 3
  const isLong = hex.length === 6
  if (!isShort && !isLong) return hexColor

  const full = isShort ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex

  const red = Number.parseInt(full.slice(0, 2), 16)
  const green = Number.parseInt(full.slice(2, 4), 16)
  const blue = Number.parseInt(full.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function getReadableTextColor(hexColor: string): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#')) return 'var(--chart-text)'

  const hex = normalized.slice(1)
  const isShort = hex.length === 3
  const isLong = hex.length === 6
  if (!isShort && !isLong) return 'var(--chart-text)'

  const full = isShort ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex

  const red = Number.parseInt(full.slice(0, 2), 16)
  const green = Number.parseInt(full.slice(2, 4), 16)
  const blue = Number.parseInt(full.slice(4, 6), 16)
  const yiq = (red * 299 + green * 587 + blue * 114) / 1000

  return yiq >= 140 ? '#2a2520' : '#ffffff'
}
