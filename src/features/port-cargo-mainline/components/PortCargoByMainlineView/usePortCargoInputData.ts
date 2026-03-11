import { useQuery } from '@tanstack/react-query'
import { useActiveSceneDataPaths } from '@/shared/hooks/useActiveSceneDataPaths'
import { fetchCsvRows } from '@/shared/lib/fetchUtils'
import { parseTeu } from '@/shared/lib/parseUtils'
import type { ContainerLoadType, CsvInputRow, MainlineGroup, PortMainlineRow } from './types'

function resolveContainerLoadType(value?: string): ContainerLoadType {
  const normalized = (value || '').trim().toUpperCase()
  return normalized === 'E' ? 'empty' : 'heavy'
}

function isDangerGoods(dangerClass?: string): boolean {
  return (dangerClass || '').trim().length > 0
}

function toPortMainlineRowFromInput(port: string, rows: CsvInputRow[]): PortMainlineRow {
  const destMap = new Map<string, { teu: number; count: number; containers: ContainerLoadType[] }>()

  rows.forEach(row => {
    const dest = (row['干线码头'] || '').trim() || '未指定码头'
    const teu = parseTeu(row.TEU)
    const danger = isDangerGoods(row['危类'])
    const loadType: ContainerLoadType = danger ? 'danger' : resolveContainerLoadType(row['L/F/E'])

    const group = destMap.get(dest) ?? { teu: 0, count: 0, containers: [] }
    group.teu += teu
    group.count += 1
    group.containers.push(loadType)
    destMap.set(dest, group)
  })

  const groups: MainlineGroup[] = Array.from(destMap.entries())
    .map(([dest, data]) => ({
      route: dest,
      routeLabel: dest,
      mainlinePort: dest,
      teu: data.teu,
      count: data.count,
      containers: data.containers
    }))
    .sort((a, b) => b.count - a.count)

  return {
    port,
    totalCount: groups.reduce((sum, g) => sum + g.count, 0),
    groups
  }
}

function buildRowsByOriginPortFromInput(allRows: CsvInputRow[]): PortMainlineRow[] {
  const portMap = new Map<string, CsvInputRow[]>()

  allRows.forEach(row => {
    const originPort = (row['起运港码头'] || '未知港口').trim() || '未知港口'
    const existing = portMap.get(originPort) ?? []
    existing.push(row)
    portMap.set(originPort, existing)
  })

  return Array.from(portMap.entries())
    .map(([port, rows]) => toPortMainlineRowFromInput(port, rows))
    .sort((a, b) => b.totalCount - a.totalCount)
}

export function usePortCargoInputData(csvFiles?: string[]) {
  const dataPaths = useActiveSceneDataPaths()

  const filePaths =
    csvFiles && csvFiles.length > 0
      ? csvFiles
      : dataPaths
        ? [dataPaths.inputNanjing, dataPaths.inputTaicang]
        : []

  const query = useQuery({
    queryKey: ['port-cargo-input-data', ...filePaths],
    enabled: filePaths.length > 0,
    queryFn: async () => {
      const allRows = (
        await Promise.all(filePaths.map(path => fetchCsvRows<CsvInputRow>(path)))
      ).flat()
      return buildRowsByOriginPortFromInput(allRows)
    }
  })

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null
  }
}
