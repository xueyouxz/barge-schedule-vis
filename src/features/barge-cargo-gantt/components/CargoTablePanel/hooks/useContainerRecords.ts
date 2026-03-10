import { useQuery } from '@tanstack/react-query'
import { fetchCsvRows } from '@/shared/lib/fetchUtils'

export type ContainerRecordRow = {
  箱号?: string
  船名?: string
  航次?: string
  实际离港时间?: string
  ['进出口（I/O）']?: string
  ['L/F/E']?: string
  危类?: string
  箱主?: string
  ['内外贸（D/F）']?: string
  重量?: string
  TEU?: string
  起运港码头?: string
  目的港码头?: string
  干线船名?: string
  干线航次?: string
  干线码头?: string
  ETD?: string
  箱就绪时间?: string
  是否中转?: string
  route?: string
  current_leg?: string
  status?: string
  location?: string
}

const DEFAULT_CONTAINER_RECORDS_PATH = '/data/output/2026-01-13 17-20-38/container_records.csv'

export function useContainerRecords(containerRecordsPath?: string) {
  const query = useQuery({
    queryKey: ['container-records', containerRecordsPath ?? DEFAULT_CONTAINER_RECORDS_PATH],
    queryFn: () =>
      fetchCsvRows<ContainerRecordRow>(containerRecordsPath ?? DEFAULT_CONTAINER_RECORDS_PATH)
  })

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null
  }
}
