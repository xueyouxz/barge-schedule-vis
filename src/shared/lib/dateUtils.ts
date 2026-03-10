type TimeRangeLike = {
  startTime: Date
  endTime: Date
}

export function parseDateTime(value: string | undefined): number {
  if (!value) return Number.NaN

  const matched = value
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (!matched) return Number.NaN

  const [, year, month, day, hour, minute, second] = matched
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime()
}

export function formatEventTimeRange(event: TimeRangeLike): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return `${formatter.format(event.startTime)} - ${formatter.format(event.endTime)}`
}
