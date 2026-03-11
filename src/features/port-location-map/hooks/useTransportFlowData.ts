import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCsvRows } from '@/shared/lib/fetchUtils'
import { useActiveSceneDataPaths } from '@/shared/hooks/useActiveSceneDataPaths'
import {
  NINGBO_TERMINAL_SET,
  NINGBO_TERMINAL_IDS,
  type NingboTerminalId
} from '../constants/terminalConfig'

/**
 * container_records.csv 中与转码头相关的字段子集。
 * 转码头定义：目的港码头（驳船实际卸货港）≠ 干线码头（货轮靠泊的真实目的地）。
 */
type ContainerTransportRow = {
  目的港码头?: string
  干线码头?: string
}

/** 单条转码头流量记录（箱数口径，非 TEU） */
export interface TransportFlow {
  /** 驳船实际卸货的宁波码头（流量起点） */
  source: NingboTerminalId
  /** 货物最终需要去往的宁波码头（流量终点） */
  target: NingboTerminalId
  /** 货箱数量 */
  count: number
}

export interface TransportFlowResult {
  flows: TransportFlow[]
  /** 参与流转的码头集合（有序，保持与 NINGBO_TERMINAL_IDS 顺序一致） */
  activeTerminals: NingboTerminalId[]
  /** D3 chord layout 所需的 n×n 方阵，matrix[i][j] = i→j 的筱数；i===j 为同码头直达筱 */
  matrix: number[][]
  /** 连跨码头的转码头筱数 */
  transportCount: number
  /** 同码头直达无需转码头的筱数 */
  selfCount: number
  isLoading: boolean
  error: string | null
}

export function useTransportFlowData(): TransportFlowResult {
  const paths = useActiveSceneDataPaths()
  const url = paths?.containerRecords

  const query = useQuery({
    queryKey: ['port-transport-flow', url],
    enabled: Boolean(url),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchCsvRows<ContainerTransportRow>(url as string)
  })

  return useMemo<TransportFlowResult>(() => {
    const rows = query.data ?? []
    const flowMap = new Map<string, number>()

    for (const row of rows) {
      const src = row['目的港码头']?.trim()
      const tgt = row['干线码头']?.trim()

      // 统计所有宁波港区筱（含同码头直达），对角线入阵 = 正确分配无需转码
      if (src && tgt && NINGBO_TERMINAL_SET.has(src) && NINGBO_TERMINAL_SET.has(tgt)) {
        const key = `${src}\x00${tgt}`
        flowMap.set(key, (flowMap.get(key) ?? 0) + 1)
      }
    }

    const flows: TransportFlow[] = []
    for (const [key, count] of flowMap) {
      const sep = key.indexOf('\x00')
      const source = key.slice(0, sep) as NingboTerminalId
      const target = key.slice(sep + 1) as NingboTerminalId
      flows.push({ source, target, count })
    }

    // 保持与 NINGBO_TERMINAL_IDS 相同的顺序，只保留有流量的码头
    const involvedSet = new Set<string>()
    flows.forEach(({ source, target }) => {
      involvedSet.add(source)
      involvedSet.add(target)
    })
    const activeTerminals = NINGBO_TERMINAL_IDS.filter(id => involvedSet.has(id))

    // 构建 D3 chord 所需的 n×n 方阵（对角线 = 直达筱，非对角 = 转码头筱）
    const n = activeTerminals.length
    const matrix: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0))
    const idxMap = new Map(activeTerminals.map((id, i) => [id, i]))

    let transportCount = 0
    let selfCount = 0

    for (const { source, target, count } of flows) {
      const si = idxMap.get(source)
      const ti = idxMap.get(target)
      if (si !== undefined && ti !== undefined) {
        matrix[si][ti] += count
        if (si === ti) {
          selfCount += count
        } else {
          transportCount += count
        }
      }
    }

    return {
      flows,
      activeTerminals,
      matrix,
      transportCount,
      selfCount,
      isLoading: query.isLoading,
      error: query.error instanceof Error ? query.error.message : null
    }
  }, [query.data, query.isLoading, query.error])
}
