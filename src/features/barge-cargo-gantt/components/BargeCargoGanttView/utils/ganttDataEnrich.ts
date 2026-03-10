import { extractRouteChain, parseTeu } from '@/shared/lib/parseUtils'
import type { GanttDataset, GanttEvent, TransshipConnection } from '../types'

export type ContainerRecordRow = {
  箱号?: string
  船名?: string
  航次?: string
  TEU?: string
  ETD?: string
  起运港码头?: string
  目的港码头?: string
  route?: string
}

function parseSimTime(value?: string): Date | null {
  if (!value) return null

  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function resolveMainlinePort(route: string | undefined, fallbackPort: string): string {
  const chain = extractRouteChain(route)
  return chain[chain.length - 1] || fallbackPort || '未指定干线码头'
}

export type RouteLeg = {
  fromPort: string
  toPort: string
  bargeId: number
}

/**
 * 解析 route 字符串中的每个运输段，返回 [{fromPort, toPort, bargeId}, ...] 数组。
 * route 格式：[('QBA', 'TC2', 0), ('TC2', 'BLCT3', 2)]
 * bargeId 与 barge_records.json 的整数键对应，可据此查到实际承运驳船的 vessel/voyage。
 */
export function parseRouteLegs(route?: string): RouteLeg[] {
  if (!route) return []

  const tupleRegex = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)/g
  const legs: RouteLeg[] = []
  let match: RegExpExecArray | null

  while ((match = tupleRegex.exec(route)) !== null) {
    legs.push({
      fromPort: match[1].trim(),
      toPort: match[2].trim(),
      bargeId: parseInt(match[3], 10)
    })
  }

  return legs
}

function buildEventLookup(dataset: GanttDataset) {
  const loadingEvents = new Map<string, GanttEvent[]>()
  const unloadingEvents = new Map<string, GanttEvent[]>()

  dataset.events.forEach(event => {
    if (event.type !== 'loading' && event.type !== 'unloading') return

    const key = `${event.vessel}|${event.voyage}|${event.port}`
    const target = event.type === 'loading' ? loadingEvents : unloadingEvents
    const list = target.get(key) ?? []
    list.push(event)
    target.set(key, list)
  })

  const sortByEndTime = (left: GanttEvent, right: GanttEvent) =>
    left.endTime.getTime() - right.endTime.getTime()

  loadingEvents.forEach(list => list.sort(sortByEndTime))
  unloadingEvents.forEach(list => list.sort(sortByEndTime))

  return { loadingEvents, unloadingEvents }
}

function findBestConnectionEventsForLegPair(
  fromLeg: RouteLeg,
  toLeg: RouteLeg,
  loadingEvents: Map<string, GanttEvent[]>,
  unloadingEvents: Map<string, GanttEvent[]>,
  bargeIdToVesselVoyage: Map<number, string>
): { fromEvent: GanttEvent; toEvent: GanttEvent } | null {
  const fromVesselVoyage = bargeIdToVesselVoyage.get(fromLeg.bargeId)
  const toVesselVoyage = bargeIdToVesselVoyage.get(toLeg.bargeId)
  if (!fromVesselVoyage || !toVesselVoyage) return null

  const fromCandidates = unloadingEvents.get(`${fromVesselVoyage}|${fromLeg.toPort}`) ?? []
  const toCandidates = loadingEvents.get(`${toVesselVoyage}|${toLeg.fromPort}`) ?? []
  if (!fromCandidates.length || !toCandidates.length) return null

  let bestPair: { fromEvent: GanttEvent; toEvent: GanttEvent } | null = null
  let bestGap = Number.POSITIVE_INFINITY

  fromCandidates.forEach(fromEvent => {
    toCandidates.forEach(toEvent => {
      const gap = toEvent.endTime.getTime() - fromEvent.endTime.getTime()
      if (gap < 0) return

      if (gap < bestGap) {
        bestGap = gap
        bestPair = { fromEvent, toEvent }
      }
    })
  })

  return bestPair
}

export function buildTransshipConnectionsFromContainerRows(
  dataset: GanttDataset,
  containerRows: ContainerRecordRow[],
  bargeIdToVesselVoyage: Map<number, string>
): TransshipConnection[] {
  const { loadingEvents, unloadingEvents } = buildEventLookup(dataset)
  const connectionTotals = new Map<string, { teu: number; count: number }>()

  containerRows.forEach(row => {
    const legs = parseRouteLegs(row.route)
    if (legs.length < 2) return

    const teu = parseTeu(row.TEU)
    if (teu <= 0) return

    for (let index = 0; index < legs.length - 1; index += 1) {
      const currentLeg = legs[index]
      const nextLeg = legs[index + 1]

      if (currentLeg.bargeId === nextLeg.bargeId) continue
      if (currentLeg.toPort !== nextLeg.fromPort) continue

      const matchedEvents = findBestConnectionEventsForLegPair(
        currentLeg,
        nextLeg,
        loadingEvents,
        unloadingEvents,
        bargeIdToVesselVoyage
      )
      if (!matchedEvents) continue

      const connectionKey = `${matchedEvents.fromEvent.id}->${matchedEvents.toEvent.id}`
      const current = connectionTotals.get(connectionKey) ?? { teu: 0, count: 0 }
      current.teu += teu
      current.count += 1
      connectionTotals.set(connectionKey, current)
    }
  })

  return Array.from(connectionTotals.entries())
    .map(([key, totals]) => {
      const [fromEventId, toEventId] = key.split('->')
      return {
        id: `TC-${fromEventId}-${toEventId}`,
        fromEventId,
        toEventId,
        teu: totals.teu,
        count: totals.count
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * 将货箱明细与甘特图装卸事件关联。
 *
 * 核心思路：
 * CSV 中的 `船名/航次` 是货物的"原始归属船"，不是每段实际承运驳船，不能直接用于匹配。
 * 正确做法是解析 route 字符串中的每一段 (fromPort, toPort, bargeId)，
 * 通过 bargeIdToVesselVoyage 找到实际承运驳船（vessel|voyage），
 * 再按 vessel|voyage|port 匹配甘特图事件。
 *
 * 示例：
 *   route = [('QBA','TC2',0), ('TC2','BLCT3',2)]
 *   → barge 0（RUNFAZHIBAO|25635S）: loadBucket[QBA] + unloadBucket[TC2]
 *   → barge 2（HUA ZHENG JI YUN|25635S）: loadBucket[TC2] + unloadBucket[BLCT3]
 */
export function enrichEventCargoDetails(
  dataset: GanttDataset,
  containerRows: ContainerRecordRow[],
  bargeIdToVesselVoyage: Map<number, string>
) {
  type PreparedRow = {
    containerNo: string
    teu: number
    mainlinePort: string
  }

  const loadBuckets = new Map<string, PreparedRow[]>()
  const unloadBuckets = new Map<string, PreparedRow[]>()

  const appendBucket = (target: Map<string, PreparedRow[]>, key: string, row: PreparedRow) => {
    const list = target.get(key) ?? []
    list.push(row)
    target.set(key, list)
  }

  containerRows.forEach(row => {
    const teu = parseTeu(row.TEU)
    const containerNo = (row.箱号 || '').trim()
    const unloadPort = (row.目的港码头 || '').trim()
    const mainlinePort = resolveMainlinePort(row.route, unloadPort || (row.起运港码头 || '').trim())
    const preparedRow: PreparedRow = { containerNo, teu, mainlinePort }

    parseRouteLegs(row.route).forEach(leg => {
      const vesselVoyage = bargeIdToVesselVoyage.get(leg.bargeId)
      if (!vesselVoyage) return

      appendBucket(loadBuckets, `${vesselVoyage}|${leg.fromPort}`, preparedRow)
      appendBucket(unloadBuckets, `${vesselVoyage}|${leg.toPort}`, preparedRow)
    })
  })

  dataset.events
    .filter(event => event.type === 'loading' || event.type === 'unloading')
    .forEach(event => {
      const key = `${event.vessel}|${event.voyage}|${event.port}`
      const rows = (event.type === 'loading' ? loadBuckets : unloadBuckets).get(key) ?? []
      if (!rows.length) return

      const groupMap = new Map<string, { teu: number; count: number; sampleContainers: string[] }>()
      rows.forEach(row => {
        const groupKey = row.mainlinePort || '未指定干线码头'
        const group = groupMap.get(groupKey)

        if (group) {
          group.teu += row.teu
          group.count += 1
          if (row.containerNo && group.sampleContainers.length < 4) {
            group.sampleContainers.push(row.containerNo)
          }
          return
        }

        groupMap.set(groupKey, {
          teu: row.teu,
          count: 1,
          sampleContainers: row.containerNo ? [row.containerNo] : []
        })
      })

      event.cargoDetail = {
        totalTeu: rows.reduce((sum, row) => sum + row.teu, 0),
        totalCount: rows.length,
        groups: Array.from(groupMap.entries())
          .map(([mainlinePort, group]) => ({
            mainlinePort,
            teu: group.teu,
            count: group.count,
            sampleContainers: group.sampleContainers
          }))
          .sort((left, right) => right.teu - left.teu)
      }
    })
}

export function buildEtdMarksFromContainerRows(
  rows: ContainerRecordRow[],
  dataset: GanttDataset
): GanttDataset['etdMarks'] {
  const vesselVoyageSet = new Set(dataset.ships.map(ship => `${ship.vessel}|${ship.voyage}`))
  const grouped = new Map<string, { time: Date; count: number }>()

  rows.forEach(row => {
    const vessel = row.船名
    const voyage = row.航次
    if (!vessel || !voyage) return
    if (!vesselVoyageSet.has(`${vessel}|${voyage}`)) return

    const etd = parseSimTime(row.ETD)
    if (!etd) return

    const rounded = new Date(etd)
    rounded.setMinutes(0, 0, 0)
    const key = rounded.toISOString()
    const previous = grouped.get(key)

    if (previous) {
      previous.count += 1
      return
    }

    grouped.set(key, { time: rounded, count: 1 })
  })

  return Array.from(grouped.values())
    .map(group => ({
      hour: (group.time.getTime() - dataset.startTime.getTime()) / (60 * 60 * 1000),
      label: `ETD(${group.count})`
    }))
    .filter(mark => mark.hour >= 0)
    .sort((left, right) => left.hour - right.hour)
}
