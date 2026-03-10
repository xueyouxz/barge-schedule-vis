import { useQuery } from '@tanstack/react-query'
import type { BargeInfoRaw, BargeRecordRaw, GanttDataset } from '../types'
import { fetchCsvRows, fetchJson, fetchJsonOptional } from '@/shared/lib/fetchUtils'
import { useActiveSceneDataPaths } from '@/shared/hooks/useActiveSceneDataPaths'
import {
  buildEtdMarksFromContainerRows,
  buildTransshipConnectionsFromContainerRows,
  enrichEventCargoDetails,
  type ContainerRecordRow
} from '../utils/ganttDataEnrich'
import { buildBargeCargoGanttData } from '../utils/transform'

export function useBargeCargoGanttData(
  infoPath?: string,
  recordsPath?: string,
  containerRecordsPath?: string
) {
  const dataPaths = useActiveSceneDataPaths()
  const infoUrl = infoPath ?? dataPaths?.bargeInfos
  const recUrl = recordsPath ?? dataPaths?.bargeRecords
  const containerUrl = containerRecordsPath ?? dataPaths?.containerRecords

  const query = useQuery({
    queryKey: ['barge-cargo-gantt-data', infoUrl, recUrl, containerUrl],
    enabled: Boolean(infoUrl && recUrl && containerUrl),
    queryFn: async (): Promise<GanttDataset | null> => {
      const [infos, rawRecords, containerRows] = await Promise.all([
        fetchJson<BargeInfoRaw[]>(infoUrl as string),
        fetchJsonOptional<Record<string, BargeRecordRaw>>(recUrl as string),
        fetchCsvRows<ContainerRecordRow>(containerUrl as string).catch(() => null)
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

        dataset.transshipConnections = buildTransshipConnectionsFromContainerRows(
          dataset,
          containerRows,
          bargeIdToVesselVoyage
        )
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
