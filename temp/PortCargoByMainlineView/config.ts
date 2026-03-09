/**
 * 视图画布边距配置。
 *
 * 用于给坐标轴标签和上下留白预留空间，避免图形贴边。
 * - top: 顶部留白，给首行内容呼吸空间。
 * - right: 右侧留白，避免末尾文字被裁切。
 * - bottom: 底部留白，避免最后一行视觉拥挤。
 * - left: 左侧留白，主要用于港口名称标签。
 */
export const VIEW_MARGIN = { top: 10, right: 25, bottom: 10, left: 50 } as const

/**
 * 同一港口行内，不同主线路径矩形块之间的水平间距（像素）。
 * 间距过小会导致块体粘连，过大则浪费可视宽度。
 */
export const BLOCK_GAP = 8

/**
 * 每行内容区域最小高度（像素）。
 * 当港口行数很多时，行高会被压缩；此值用于保障最小可读性。
 */
export const MIN_ROW_INNER_HEIGHT = 18

/**
 * 每行内容区域绝对最小保护高度（像素）。
 * 当港口数量很多时，仍保留最小绘制高度，确保离散箱格可见。
 */
export const ROW_INNER_HEIGHT_FLOOR = 16

/**
 * 行内容区域与 band 的最小安全间隙（像素）。
 * 通过将内容高度限制在 band 高度以内，避免行间覆盖。
 */
export const ROW_INNER_SAFE_GAP = 15

/**
 * 行内“可绘制矩形区”相对 band 高度的收缩量（像素）。
 * 用于在每行上下保留少量空隙，减少视觉拥堵。
 */
export const ROW_INNER_HEIGHT_SHRINK = 0

/**
 * 港口行 band 的内部间距（d3 scaleBand 的 paddingInner）。
 * 数值越大，行与行之间间距越明显。
 */
export const ROW_BAND_PADDING_INNER = 0.12

/**
 * 绘制计数文本（如箱量）的显示阈值。
 * 仅当矩形块尺寸达到阈值时显示，避免文字重叠。
 */
export const COUNT_LABEL_MIN_BLOCK_WIDTH = 24
export const COUNT_LABEL_MIN_BLOCK_HEIGHT = 14

/**
 * 目的路径标签显示阈值。
 * 仅当矩形块尺寸达到阈值时显示，避免在窄小块体中发生文字遮挡。
 */
export const ROUTE_LABEL_MIN_BLOCK_WIDTH = 22
export const ROUTE_LABEL_MIN_BLOCK_HEIGHT = 14

/**
 * 目的路径标签的最小内边距偏移（像素）。
 * - x: 保证文字不会紧贴左侧。
 * - y: 保证文字不会贴到底边。
 */
export const DEST_LABEL_MIN_OFFSET = { x: 2, y: 8 } as const

/**
 * 离散箱格（每个箱子一个小矩形）布局参数。
 *
 * - padding: 大矩形内边距，避免箱格贴边。
 * - gap: 箱格之间的间距。
 * - columnSearchScales: 近似列数的候选缩放因子，用于在宽高比变化时
 *   自动搜索更合适的网格列数，尽量让每个小格接近正方形。
 */
export const CONTAINER_GRID = {
  padding: 2,
  gap: 1,
  columnSearchScales: [0.75, 1, 1.25],
} as const

/**
 * 行背景与分隔线样式。
 * 用于提升行分组感，但不干扰主图形阅读。
 */
export const ROW_DECORATION_STYLE = {
  backgroundFill: '#f6f8fa',
  backgroundOpacity: 0.22,
  dividerStroke: '#9a9a9a',
  dividerDashArray: '10 8',
  dividerOpacity: 0.8,
} as const

/**
 * 主块与离散箱格的描边样式。
 * - blockStrokeWidth: 外层主块边框宽度。
 * - cellStrokeWidth: 内部离散箱格边框宽度。
 * - emptyCellOpacity: 空箱（无填充）透明度。
 * - heavyCellOpacity: 重箱（有填充）透明度。
 */
export const BLOCK_STYLE = {
  emptyCellFill: '#e5e7eb',
  blockStrokeWidth: 1,
  cellStrokeWidth: 0.5,
  emptyCellOpacity: 0.7,
  heavyCellOpacity: 0.95,
} as const

/**
 * 港口标签位置微调。
 *
 * - x: 负值表示位于绘图区左侧。
 * - y: 基于行中心的纵向微调，保证视觉居中。
 */
export const PORT_LABEL_OFFSET = { x: -12, y: 5 } as const

/**
 * 默认组件尺寸。
 * 当外部不传宽高时使用，保证独立渲染时有合理大小。
 */
export const DEFAULT_VIEW_SIZE = { width: 1280, height: 680 } as const
