export type TraceStatus =
  | 'start_load'
  | 'end_load'
  | 'start_unload'
  | 'end_unload'
  | 'depart'
  | 'arrive'
  | 'start_berth'
  | 'finish_berth'
  | 'setup'
  | 'wrapup'
  | 'unberth'
  | string

export interface BargeTracePoint {
  time: string
  port: string
  status: TraceStatus
}

export interface BargeContSummary {
  port: string
  num_large: number
  num_regular: number
  num_danger?: number
  num_onboard: number
}

export interface BargeInfoRaw {
  vessel: string
  voyage: string
  from?: string
  trace: BargeTracePoint[]
  cont_summary?: BargeContSummary[]
}

export interface BargeRecordRaw {
  vessel: string
  voyage: string
  max_teu?: number
  unload?: Record<string, { num_transship?: number }>
}

export type GanttEventType = 'loading' | 'unloading' | 'sailing' | 'waiting' | 'wrapup'

export interface GanttEvent {
  id: string
  shipId: string
  vessel: string
  voyage: string
  port: string
  type: GanttEventType
  startTime: Date
  endTime: Date
  startHour: number
  endHour: number
  teu?: number
  maxTeu?: number
  cargo?: {
    big: number
    normal: number
    danger: number
    onboard: number
  }
  cargoDetail?: {
    totalTeu: number
    totalCount: number
    groups: Array<{
      mainlinePort: string
      teu: number
      count: number
      sampleContainers: string[]
    }>
  }
}

export interface PortSummaryEvent {
  id: string
  shipId: string
  vessel: string
  voyage: string
  port: string
  type: 'port-summary'
  startTime: Date
  endTime: Date
  startHour: number
  endHour: number
  cargoDetail?: GanttEvent['cargoDetail']
}

export type InteractiveEvent = GanttEvent | PortSummaryEvent

export interface ShipRow {
  id: string
  vessel: string
  voyage: string
  from: string
  maxTeu: number
  events: GanttEvent[]
}

export interface TransshipConnection {
  id: string
  fromEventId: string
  toEventId: string
  teu: number
  count: number
}

export interface GanttDataset {
  startTime: Date
  endTime: Date
  endHour: number
  ships: ShipRow[]
  events: GanttEvent[]
  transshipConnections: TransshipConnection[]
  etdMarks: Array<{ hour: number; label: string }>
}

export interface BargeCargoGanttViewProps {
  infoPath?: string
  recordsPath?: string
  containerRecordsPath?: string
  /** 点击港口停靠区域或装卸货矩形块时的回调 */
  onBarClick?: (ev: InteractiveEvent) => void
}
