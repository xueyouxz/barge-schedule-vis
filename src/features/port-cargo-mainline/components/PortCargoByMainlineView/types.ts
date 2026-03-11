export interface PortCargoByMainlineViewProps {
  width?: number
  height?: number
  csvFiles?: string[]
  selectedPort?: string
  dataMode?: 'output' | 'input'
  onBarClick?: (portId: string, route: string) => void
}

export interface CsvContainerRow {
  TEU?: string
  起运港码头?: string
  route?: string
  'L/F/E'?: string
}

export interface CsvInputRow {
  TEU?: string
  起运港码头?: string
  干线码头?: string
  'L/F/E'?: string
  危类?: string
}

export type ContainerLoadType = 'empty' | 'heavy' | 'danger'

export interface MainlineGroup {
  route: string
  routeLabel: string
  mainlinePort: string
  teu: number
  count: number
  containers: ContainerLoadType[]
}

export interface PortMainlineRow {
  port: string
  totalCount: number
  groups: MainlineGroup[]
}
