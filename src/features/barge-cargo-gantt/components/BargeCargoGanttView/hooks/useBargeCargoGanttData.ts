import { useQuery } from '@tanstack/react-query'
import type { BargeInfoRaw, BargeRecordRaw, GanttDataset } from '../types'
import { DATA_PATHS } from '@/shared/constants/scenarioConfig'
import { fetchCsvRows, fetchJson, fetchJsonOptional } from '@/shared/lib/fetchUtils'
import {
  buildEtdMarksFromContainerRows,
  enrichEventCargoDetails,
  type ContainerRecordRow
} from '../utils/ganttDataEnrich'
import { buildBargeCargoGanttData } from '../utils/transform'

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
