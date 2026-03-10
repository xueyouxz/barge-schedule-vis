import { useQuery } from '@tanstack/react-query'
import type { BargeInfoRaw, BargeRecordRaw, GanttDataset } from '../types'
import { DATA_PATHS } from '@/shared/constants/scenarioConfig'
import { fetchCsvRows, fetchJson, fetchJsonOptional } from '@/shared/lib/fetchUtils'
import { buildBargeCargoGanttData } from '../utils/transform'

type ContainerRecordRow = {
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
  const d = new Date(value.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function parseTeu(value?: string): number {
  if (!value) return 0
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function extractRouteChain(route?: string): string[] {
  const raw = (route || '').trim()
  if (!raw) return []

  const tokenMatches = Array.from(raw.matchAll(/'([^']+)'/g))
    .map(m => m[1]?.trim())
    .filter(Boolean) as string[]
  if (tokenMatches.length < 2) return []

  const chain: string[] = []
  tokenMatches.forEach(token => {
    if (chain.length === 0 || chain[chain.length - 1] !== token) {
      chain.push(token)
    }
  })
  return chain
}

function resolveMainlinePort(route: string | undefined, fallbackPort: string): string {
  const chain = extractRouteChain(route)
  return chain[chain.length - 1] || fallbackPort || '未指定干线码头'
}

/**
 * 解析 route 字符串中的每个运输段，返回 [{fromPort, toPort, bargeId}, ...] 数组。
 * route 格式：[('QBA', 'TC2', 0), ('TC2', 'BLCT3', 2)]
 * bargeId 与 barge_records.json 的整数键对应，可据此查到实际承运驳船的 vessel/voyage。
 */
function parseRouteLegs(
  route?: string
): Array<{ fromPort: string; toPort: string; bargeId: number }> {
  if (!route) return []
  const tupleRegex = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)/g
  const legs: Array<{ fromPort: string; toPort: string; bargeId: number }> = []
  let match
  while ((match = tupleRegex.exec(route)) !== null) {
    legs.push({
      fromPort: match[1].trim(),
      toPort: match[2].trim(),
      bargeId: parseInt(match[3], 10)
    })
  }
  return legs
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
function enrichEventCargoDetails(
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
    // mainlinePort 取 route 链路的最终目的港，用于弹窗中按干线港分组展示
    const mainlinePort = resolveMainlinePort(row.route, unloadPort || (row.起运港码头 || '').trim())
    const preparedRow: PreparedRow = { containerNo, teu, mainlinePort }

    // 按 route 的每一段 (fromPort, toPort, bargeId) 将货箱分配到实际承运驳船的 bucket
    const legs = parseRouteLegs(row.route)
    legs.forEach(leg => {
      const vesselVoyage = bargeIdToVesselVoyage.get(leg.bargeId)
      if (!vesselVoyage) return
      appendBucket(loadBuckets, `${vesselVoyage}|${leg.fromPort}`, preparedRow)
      appendBucket(unloadBuckets, `${vesselVoyage}|${leg.toPort}`, preparedRow)
    })
  })

  dataset.events
    .filter(ev => ev.type === 'loading' || ev.type === 'unloading')
    .forEach(ev => {
      const key = `${ev.vessel}|${ev.voyage}|${ev.port}`
      const rows = (ev.type === 'loading' ? loadBuckets : unloadBuckets).get(key) ?? []
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
        } else {
          groupMap.set(groupKey, {
            teu: row.teu,
            count: 1,
            sampleContainers: row.containerNo ? [row.containerNo] : []
          })
        }
      })

      ev.cargoDetail = {
        totalTeu: rows.reduce((sum, row) => sum + row.teu, 0),
        totalCount: rows.length,
        groups: Array.from(groupMap.entries())
          .map(([mainlinePort, group]) => ({
            mainlinePort,
            teu: group.teu,
            count: group.count,
            sampleContainers: group.sampleContainers
          }))
          .sort((a, b) => b.teu - a.teu)
      }
    })
}

function buildEtdMarksFromContainerRows(
  rows: ContainerRecordRow[],
  dataset: GanttDataset
): GanttDataset['etdMarks'] {
  const vesselVoyageSet = new Set(dataset.ships.map(s => `${s.vessel}|${s.voyage}`))
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

    const prev = grouped.get(key)
    if (prev) {
      prev.count += 1
    } else {
      grouped.set(key, { time: rounded, count: 1 })
    }
  })

  const marks = Array.from(grouped.values())
    .map(g => {
      const hour = (g.time.getTime() - dataset.startTime.getTime()) / (60 * 60 * 1000)
      return {
        hour,
        label: `ETD(${g.count})`
      }
    })
    .filter(m => m.hour >= 0)
    .sort((a, b) => a.hour - b.hour)

  return marks
}

export function useBargeCargoGanttData(
  infoPath?: string,
  recordsPath?: string,
  containerRecordsPath?: string
) {
  const infoUrl = infoPath ?? DATA_PATHS.bargeInfos
  const recUrl = recordsPath ?? DATA_PATHS.bargeRecords
  const containerUrl = containerRecordsPath ?? DATA_PATHS.containerRecords

  const query = useQuery({
    queryKey: ['barge-cargo-gantt-data', infoUrl, recUrl, containerUrl],
    queryFn: async (): Promise<GanttDataset | null> => {
      const [infos, rawRecords, containerRows] = await Promise.all([
        fetchJson<BargeInfoRaw[]>(infoUrl),
        fetchJsonOptional<Record<string, BargeRecordRaw>>(recUrl),
        fetchCsvRows<ContainerRecordRow>(containerUrl).catch(() => null)
      ])

      const recordMap = new Map<string, BargeRecordRaw>()
      const bargeIdToVesselVoyage = new Map<number, string>()

      if (rawRecords) {
        Object.entries(rawRecords).forEach(([idStr, record]) => {
          recordMap.set(`${record.vessel}|${record.voyage}`, record)
          const id = parseInt(idStr, 10)
          if (!Number.isNaN(id)) {
            bargeIdToVesselVoyage.set(id, `${record.vessel}|${record.voyage}`)
          }
        })
      }

      const dataset = buildBargeCargoGanttData(infos, recordMap)
      if (!dataset) {
        return null
      }

      if (containerRows && containerRows.length > 0) {
        const marks = buildEtdMarksFromContainerRows(containerRows, dataset)
        if (marks.length > 0) {
          dataset.etdMarks = marks
        }

        enrichEventCargoDetails(dataset, containerRows, bargeIdToVesselVoyage)
      }

      return dataset
    }
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null
  }
}
