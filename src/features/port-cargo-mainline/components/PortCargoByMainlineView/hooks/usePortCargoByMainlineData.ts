import { useEffect, useState } from 'react'
import * as d3 from 'd3'
import type { ContainerLoadType, CsvContainerRow, MainlineGroup, PortMainlineRow } from '../types'

const DEFAULT_CSV_FILES = ['/data/output/2026-01-13 17-20-38/container_records.csv']

function resolveContainerRecordsPaths(fileList: string[]): string[] {
  const resolved = new Set<string>()

  const addScenarioOutputPath = (normalized: string, marker: string) => {
    const markerIndex = normalized.lastIndexOf(marker)
    if (markerIndex < 0) return false

    const scenarioRoot = normalized.slice(0, markerIndex)
    resolved.add(`${scenarioRoot}/output/container_records.csv`)
    return true
  }

  fileList.forEach(file => {
    const normalized = file.trim()
    if (!normalized) return

    if (/container_records\.csv$/i.test(normalized)) {
      resolved.add(normalized)
      return
    }

    if (addScenarioOutputPath(normalized, '/input/')) return
    addScenarioOutputPath(normalized, '/export/')
  })

  if (resolved.size === 0) {
    resolved.add(DEFAULT_CSV_FILES[0])
  }

  return Array.from(resolved)
}

function parseTeu(value?: string): number {
  if (!value) return 0

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveContainerLoadType(value?: string): ContainerLoadType {
  const normalized = (value || '').trim().toUpperCase()
  return normalized === 'E' ? 'empty' : 'heavy'
}

function normalizeRouteLabel(route?: string): string {
  const raw = (route || '').trim()
  if (!raw) return '未指定路径'

  const tokenMatches = Array.from(raw.matchAll(/'([^']+)'/g))
    .map(match => match[1]?.trim())
    .filter(Boolean) as string[]
  if (tokenMatches.length >= 2) {
    const chain: string[] = []

    tokenMatches.forEach(token => {
      if (chain.length === 0 || chain[chain.length - 1] !== token) {
        chain.push(token)
      }
    })

    if (chain.length > 1) {
      return chain.join(' → ')
    }
  }

  return raw
}

function toPortMainlineRow(port: string, rows: CsvContainerRow[]): PortMainlineRow {
  const routeMap = new Map<
    string,
    { teu: number; count: number; containers: ContainerLoadType[] }
  >()

  rows.forEach(row => {
    const route = (row.route || '').trim() || '未指定路径'
    const teu = parseTeu(row.TEU)
    const loadType = resolveContainerLoadType(row['L/F/E'])
    const routeGroup = routeMap.get(route) ?? { teu: 0, count: 0, containers: [] }

    routeGroup.teu += teu
    routeGroup.count += 1
    routeGroup.containers.push(loadType)
    routeMap.set(route, routeGroup)
  })

  const groups: MainlineGroup[] = Array.from(routeMap.entries())
    .map(([route, data]) => ({
      route,
      routeLabel: normalizeRouteLabel(route),
      teu: data.teu,
      count: data.count,
      containers: data.containers
    }))
    .sort((groupA, groupB) => groupB.count - groupA.count)

  return {
    port,
    totalCount: groups.reduce((sum, group) => sum + group.count, 0),
    groups
  }
}

function buildRowsByOriginPort(allRows: CsvContainerRow[]): PortMainlineRow[] {
  const rowsByPort = new Map<string, CsvContainerRow[]>()

  allRows.forEach(row => {
    const originPort = (row['起运港码头'] || '未知港口').trim() || '未知港口'
    const rows = rowsByPort.get(originPort) ?? []
    rows.push(row)
    rowsByPort.set(originPort, rows)
  })

  return Array.from(rowsByPort.entries())
    .map(([port, rows]) => toPortMainlineRow(port, rows))
    .sort((rowA, rowB) => rowB.totalCount - rowA.totalCount)
}

export function usePortCargoByMainlineData(csvFiles?: string[]) {
  const [data, setData] = useState<PortMainlineRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const fileList = csvFiles && csvFiles.length > 0 ? csvFiles : DEFAULT_CSV_FILES
        const containerRecordsPaths = resolveContainerRecordsPaths(fileList)
        const responses = await Promise.all(containerRecordsPaths.map(path => fetch(path)))

        for (let index = 0; index < responses.length; index += 1) {
          if (!responses[index].ok) {
            throw new Error(
              `加载文件失败: ${containerRecordsPaths[index]} (${responses[index].status})`
            )
          }
        }

        const texts = await Promise.all(responses.map(response => response.text()))
        const allRows = texts.flatMap(text => d3.csvParse(text) as CsvContainerRow[])
        const rows = buildRowsByOriginPort(allRows)

        if (active) {
          setData(rows)
        }
      } catch (error) {
        console.error('[PortCargoByMainlineView] 加载失败', error)
        if (active) {
          setData([])
          setError(error instanceof Error ? error.message : '未知错误')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [csvFiles])

  return { data, loading, error }
}
