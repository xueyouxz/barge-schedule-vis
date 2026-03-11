export interface CargoDistributionViewProps {
  width?: number
  height?: number
  csvFiles?: string[]
  dataMode?: 'output' | 'input'
}

/** 一个港口对（起运港 → 目标港）的货物分布节点 */
export interface DistributionNode {
  /** 起运港码头，如 LTA / QBA / TC2 */
  origin: string
  /** 目的港/干线港，如 BLCT3 / BLCTMS */
  dest: string
  /** 唯一 key，用于 React key 和 hover 匹配 */
  key: string
  /** 总箱数 */
  total: number
  /** TEU 合计 */
  teu: number
  /** 各货物类型切片，用于饼图渲染 */
  slices: TypeSlice[]
  /** 力布局计算后的 x 坐标（SVG 坐标系） */
  x: number
  /** 力布局计算后的 y 坐标（SVG 坐标系） */
  y: number
  /** 气泡半径 */
  r: number
  /** 力布局速度（内部使用） */
  vx: number
  /** 力布局速度（内部使用） */
  vy: number
  /** 所属分组中心 x（力布局吸引点） */
  gcx: number
  /** 所属分组中心 y（力布局吸引点） */
  gcy: number
  /** 分组序号（力布局组间排斥） */
  gIdx: number
}

/** 货物类型切片 */
export interface TypeSlice {
  /** 类型标签，如 'heavy' | 'empty' | 'danger' */
  t: CargoTypeKey
  /** 该类型的箱数 */
  v: number
}

export type CargoTypeKey = 'heavy' | 'empty' | 'danger'

/** 力布局分组（按起运港分组） */
export interface ForceGroup {
  origin: string
  /** 分组中心 x */
  cx: number
  nodes: DistributionNode[]
}

/** 凸包（用于绘制分组椭圆轮廓） */
export interface GroupHull {
  origin: string
  cx: number
  cy: number
  rx: number
  ry: number
  /** 椭圆顶部 y（用于定位分组标签） */
  top: number
}
