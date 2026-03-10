import { useQuery } from '@tanstack/react-query'
import { COMMON_DATA_ROOT } from '@/shared/constants/scenarioConfig'
import { fetchJson } from '@/shared/lib/fetchUtils'

type PortLocationRecord = Record<
  string,
  {
    name: string
    lat: number
    lon: number
  }
>

export interface PortLocation {
  code: string
  name: string
  lat: number
  lon: number
}

export function usePortLocations() {
  const query = useQuery({
    queryKey: ['shared', 'port-locations'],
    queryFn: async () => {
      const payload = await fetchJson<PortLocationRecord>(`${COMMON_DATA_ROOT}/port_locations.json`)
      return Object.entries(payload)
        .map(([code, value]) => ({
          code,
          name: value.name,
          lat: value.lat,
          lon: value.lon
        }))
        .sort((left, right) => left.code.localeCompare(right.code))
    }
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null
  }
}
