import type {
  BargeContSummary,
  BargeInfoRaw,
  BargeRecordRaw,
  GanttDataset,
  GanttEvent,
  GanttEventType,
  ShipRow
} from '../types'

const HOUR = 60 * 60 * 1000

function toDate(value: string): Date {
  return new Date(value.replace(' ', 'T'))
}

function statusToType(
  currStatus: string,
  nextStatus: string,
  samePort: boolean
): GanttEventType | null {
  if (currStatus === 'start_load' && nextStatus === 'end_load') return 'loading'
  if (currStatus === 'start_unload' && nextStatus === 'end_unload') return 'unloading'
  if (currStatus === 'depart' && nextStatus === 'arrive') return 'sailing'
  if (currStatus === 'wrapup' && samePort) return 'wrapup'
  if (samePort) return 'waiting'
  return null
}

function findSummary(
  summaries: BargeContSummary[],
  startIndex: number,
  port: string
): { index: number; summary: BargeContSummary } | null {
  for (let i = startIndex; i < summaries.length; i += 1) {
    if (summaries[i].port === port) {
      return { index: i, summary: summaries[i] }
    }
  }
  return null
}

export function buildBargeCargoGanttData(
  infos: BargeInfoRaw[],
  recordMap: Map<string, BargeRecordRaw>
): GanttDataset | null {
  if (!infos.length) return null

  const traceTimes = infos.flatMap(b => b.trace.map(t => toDate(t.time).getTime()))
  if (!traceTimes.length) return null

  const startTime = new Date(Math.min(...traceTimes))
  const endTimeRaw = new Date(Math.max(...traceTimes))

  const ships: ShipRow[] = []
  const allEvents: GanttEvent[] = []

  infos.forEach((barge, index) => {
    const shipId = `S${index + 1}`
    const sortedTrace = [...barge.trace].sort(
      (a, b) => toDate(a.time).getTime() - toDate(b.time).getTime()
    )
    const summaries = barge.cont_summary ?? []

    const record = recordMap.get(`${barge.vessel}|${barge.voyage}`)
    let summaryCursor = 0
    let onboardCursor = 0
    let cargoSnapshot: GanttEvent['cargo']

    const events: GanttEvent[] = []

    for (let i = 0; i < sortedTrace.length - 1; i += 1) {
      const curr = sortedTrace[i]
      const next = sortedTrace[i + 1]

      const s = toDate(curr.time)
      const e = toDate(next.time)
      if (s.getTime() >= e.getTime()) continue

      const type = statusToType(curr.status, next.status, curr.port === next.port)
      if (!type) continue

      let teu: number | undefined
      let cargo: GanttEvent['cargo']

      if (type === 'loading' || type === 'unloading') {
        const found = findSummary(summaries, summaryCursor, curr.port)
        if (found) {
          summaryCursor = found.index + 1
          const nextOnboard = found.summary.num_onboard

          teu =
            type === 'loading'
              ? Math.max(0, nextOnboard - onboardCursor)
              : Math.max(0, onboardCursor - nextOnboard)

          onboardCursor = nextOnboard
          cargo = {
            big: found.summary.num_large,
            normal: found.summary.num_regular,
            danger: found.summary.num_danger ?? 0,
            onboard: found.summary.num_onboard
          }
          cargoSnapshot = cargo
        }
      } else if (cargoSnapshot) {
        cargo = { ...cargoSnapshot }
        teu = cargoSnapshot.onboard
      } else if (onboardCursor > 0) {
        teu = onboardCursor
      }

      const startHour = (s.getTime() - startTime.getTime()) / HOUR
      const endHour = (e.getTime() - startTime.getTime()) / HOUR

      events.push({
        id: `${shipId}-${i}-${type}`,
        shipId,
        vessel: barge.vessel,
        voyage: barge.voyage,
        port: curr.port,
        type,
        startTime: s,
        endTime: e,
        startHour,
        endHour,
        teu,
        maxTeu: record?.max_teu,
        cargo
      })
    }

    const maxTeu =
      record?.max_teu ??
      Math.max(...summaries.map(s => s.num_onboard), ...events.map(ev => ev.teu ?? 0), 1)

    const row: ShipRow = {
      id: shipId,
      vessel: barge.vessel,
      voyage: barge.voyage,
      from: barge.from ?? '-',
      maxTeu,
      events
    }

    ships.push(row)
    allEvents.push(...events)
  })

  ships.sort((a, b) => {
    const aStart = a.events[0]?.startTime.getTime() ?? 0
    const bStart = b.events[0]?.startTime.getTime() ?? 0
    return aStart - bStart
  })

  const endHourRaw = (endTimeRaw.getTime() - startTime.getTime()) / HOUR
  const endHour = Math.ceil(endHourRaw + 6)

  const etdMarks = Array.from({ length: Math.floor(endHour / 24) }, (_, i) => {
    const hour = (i + 1) * 24
    return { hour, label: `ETD-${i + 1}` }
  })

  return {
    startTime,
    endTime: new Date(startTime.getTime() + endHour * HOUR),
    endHour,
    ships,
    events: allEvents,
    transshipConnections: [],
    etdMarks
  }
}
