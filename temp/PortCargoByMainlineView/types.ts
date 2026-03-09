export interface PortCargoByMainlineViewProps {
  width?: number
  height?: number
  csvFiles?: string[]
  /** 点击货物矩形块时的回调 */
  onBarClick?: (portId: string, route: string) => void
}

export interface CsvContainerRow {
  TEU?: string
  起运港码头?: string
  route?: string
  'L/F/E'?: string
}

export type ContainerLoadType = 'empty' | 'heavy'

export interface MainlineGroup {
  route: string
  routeLabel: string
  teu: number
  count: number
  containers: ContainerLoadType[]
}

export interface PortMainlineRow {
  port: string
  totalCount: number
  groups: MainlineGroup[]
}
