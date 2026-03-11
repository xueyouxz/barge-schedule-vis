import { useMemo } from 'react'
import { usePortCargoByMainlineData } from '../../PortCargoByMainlineView/usePortCargoByMainlineData'
import { usePortCargoInputData } from '../../PortCargoByMainlineView/usePortCargoInputData'
import { buildForceGroups, buildGroupHulls, runForceLayout } from '../utils/buildDistributionData'
import type { DistributionNode, ForceGroup, GroupHull } from '../types'

export interface CargoDistributionResult {
  origins: string[]
  destinations: string[]
  nodes: DistributionNode[]
  groups: ForceGroup[]
  hulls: GroupHull[]
  loading: boolean
  error: string | null
}

/**
 * 聚合货物分布数据，转换为力布局可直接消费的结构。
 *
 * - input 模式：读取输入 CSV（inputNanjing / inputTaicang），
 *   以「干线码头」作为目标港（初始分布，即货物期望去哪）
 * - output 模式：读取 container_records.csv，
 *   以「route 末端港」作为目标港（仿真后实际分配结果）
 */
export function useCargoDistributionData(
  dataMode: 'input' | 'output',
  csvFiles?: string[]
): CargoDistributionResult {
  const outputResult = usePortCargoByMainlineData(dataMode === 'output' ? csvFiles : [])
  const inputResult = usePortCargoInputData(dataMode === 'input' ? csvFiles : [])

  const { data, loading, error } = dataMode === 'input' ? inputResult : outputResult

  // 从数据中提取起运港（维持原始顺序，保留力布局 Y 偏移语义）
  const origins = useMemo(() => data.map(row => row.port), [data])

  // 从数据中提取所有目标港（去重）
  const destinations = useMemo(
    () => [...new Set(data.flatMap(row => row.groups.map(g => g.mainlinePort)).filter(Boolean))],
    [data]
  )

  // 力布局：仅在数据就绪且非加载态时运行（避免每次渲染重算）
  const { nodes, groups, hulls } = useMemo(() => {
    if (loading || error || data.length === 0) {
      return { nodes: [], groups: [], hulls: [] }
    }

    const forceGroups = buildForceGroups(data, origins)
    const layoutNodes = runForceLayout(forceGroups)
    const layoutHulls = buildGroupHulls(origins, layoutNodes)

    return { nodes: layoutNodes, groups: forceGroups, hulls: layoutHulls }
  }, [data, origins, loading, error])

  return { origins, destinations, nodes, groups, hulls, loading, error }
}
