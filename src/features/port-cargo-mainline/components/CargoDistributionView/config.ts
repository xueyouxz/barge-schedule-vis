/** SVG 画布尺寸（内部坐标系，viewBox 使用，与容器宽高无关） */
export const CANVAS_W = 1120
export const CANVAS_H = 820

/** 起运港节点行 y 坐标 */
export const TOP_Y = 58
/** 目的港节点行 y 坐标 */
export const BOT_Y = CANVAS_H - 52

/** 气泡半径范围 */
export const R_MIN = 14
export const R_MAX = 56

/** 力布局：同组内节点间最小间距 */
export const INTRA_PAD = 16
/** 力布局：跨组节点间最小间距 */
export const INTER_PAD = 40

/** 力布局迭代次数 */
export const FORCE_ITERATIONS = 400

/**
 * 各起运港分组的垂直偏移，使三组在 Y 方向上错落有致。
 * 顺序与 ORIGINS 数组一一对应。
 */
export const GROUP_Y_OFFSETS = [-45, 10, 55]

/**
 * 货物类型的中文标签映射（用于图例和 tooltip）
 */
export const CARGO_TYPE_LABELS: Record<string, string> = {
  heavy: '重箱',
  empty: '空箱',
  danger: '危险品'
}

/** 贝塞尔曲线控制点比例（0~1，越大曲线越弯） */
export const BEZ_CTRL = 0.42
