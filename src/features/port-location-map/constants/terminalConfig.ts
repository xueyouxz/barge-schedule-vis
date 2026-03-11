/** 宁波港区参与转码头业务的码头 ID 列表（与 port_locations.json 保持一致） */
export const NINGBO_TERMINAL_IDS = [
  'BLCT',
  'BLCT2',
  'BLCT3',
  'BLCTMS',
  'BLCTZS',
  'YZCT',
  'ZHCT'
] as const

export type NingboTerminalId = (typeof NINGBO_TERMINAL_IDS)[number]

export const NINGBO_TERMINAL_SET: ReadonlySet<string> = new Set<string>(NINGBO_TERMINAL_IDS)

/** Zoom 低于此值时隐藏所有流量覆盖层 */
export const FLOW_ZOOM_MIN = 2

/** Zoom 低于此阈值显示弦图，高于或等于此阈值显示码头间直连曲线 */
export const CHORD_ZOOM_MAX = 10

/** MapLibre GL source/layer ID 前缀（避免与其他 layer 冲突） */
export const FLOW_LINE_SOURCE_ID = 'ningbo-transport-flow'
export const FLOW_LINE_LAYER_ID = 'ningbo-transport-flow-line'
