export function fmt(value: number | undefined): string {
  if (value === undefined || value === null) return '-'
  const formatted = value.toFixed(1)
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted
}

export function fmtNum(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '-'

  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numeric)) return String(value)

  return fmt(numeric)
}

export function fmtDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`
}

export function fmtDayLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

export function fmtHours(hours: number): string {
  const safe = Math.max(0, hours)
  const rounded = Math.round(safe * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}
