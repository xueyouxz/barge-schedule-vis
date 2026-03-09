export const VIEW_MARGIN = { top: 10, right: 25, bottom: 10, left: 50 } as const

export const BLOCK_GAP = 8

export const MIN_ROW_INNER_HEIGHT = 18
export const ROW_INNER_HEIGHT_FLOOR = 16
export const ROW_INNER_SAFE_GAP = 15
export const ROW_INNER_HEIGHT_SHRINK = 0
export const ROW_BAND_PADDING_INNER = 0.12

export const COUNT_LABEL_MIN_BLOCK_WIDTH = 24
export const COUNT_LABEL_MIN_BLOCK_HEIGHT = 14

export const CONTAINER_GRID = {
  padding: 2,
  gap: 1,
  columnSearchScales: [0.75, 1, 1.25]
} as const

export const ROW_DECORATION_STYLE = {
  backgroundOpacity: 0.72,
  dividerDashArray: '10 8',
  dividerOpacity: 0.5
} as const

export const BLOCK_STYLE = {
  blockStrokeWidth: 1,
  cellStrokeWidth: 0.5,
  emptyCellOpacity: 0.7,
  heavyCellOpacity: 0.95
} as const

export const PORT_LABEL_OFFSET = { x: -12, y: 5 } as const

export const DEFAULT_VIEW_SIZE = { width: 1280, height: 680 } as const
