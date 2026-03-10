/**
 * BargeCargoGanttView 可视化配置
 *
 * 说明：
 * - 本文件仅放置“视觉层”参数（尺寸、颜色、线型、透明度、文字样式阈值）。
 * - 业务计算（如事件转换、ETD 分组）不应放在这里。
 * - 所有值均为当前设计稿（gantt.html）与现有业务数据折中后的默认值，可按需微调。
 */
export const BARGE_CARGO_GANTT_CONFIG = {
  /**
   * 画布与布局参数
   */
  layout: {
    /** 左侧船舶标签栏宽度（px） */
    labelWidth: 0,
    /** 单条船舶轨道高度（px） */
    rowHeight: 52,
    /** 顶部时间轴头部高度（px） */
    headerHeight: 36,
    /** 画布底部内边距（px） */
    paddingBottom: 24,
    /** 画布右侧内边距（px） */
    paddingRight: 24,
    /** 装卸矩形块高度（px） */
    blockHeight: 30,
    /** 装卸块最小高度（px），用于小货量场景保持可见 */
    minBlockHeight: 8,
    /** 装卸块最大高度占轨道高度比例（不超过 0.5） */
    maxBlockHeightRatio: 0.5,
    /** 装卸块圆角（px） */
    blockRadius: 0,
    /** 装卸块最小视觉宽度（px） */
    minBlockWidth: 8
  },

  /**
   * 航行段圆环图参数
   */
  donut: {
    /** 外环最小半径（px） */
    minOuterRadius: 6,
    /** 外环最大半径（px） */
    maxOuterRadius: 36,
    /** 外环半径占单条驳船轨道高度比例 */
    outerRadiusRowHeightRatio: 0.24,
    /** 当航行段宽度 >= outerRadius * minSegmentWidthFactor 才绘制圆环 */
    minSegmentWidthFactor: 2.8,
    /** 多分片之间的角度间隔（rad） */
    segmentGap: 0.04,
    /** 扇区圆角（px） */
    cornerRadius: 1
  },

  /**
   * 时间轴参数（按日期色带）
   */
  axis: {
    /** 天级分段间隔（小时） */
    dayEveryHours: 24,
    /** 日期色带顶部偏移（px） */
    bandTop: 4,
    /** 日期色带距离头部底线的预留（px） */
    bandBottomGap: 12,
    /** 日期文字在色带内的左侧偏移（px） */
    dayLabelOffsetX: 6,
    /** 日期文字字号（px） */
    dayLabelFontSize: 10,
    /** 日期色带边框线宽（px） */
    borderWidth: 0.8
  },

  /**
   * 港口驻留背景区块（按到港时段绘制）
   */
  portBand: {
    /** 区块在轨道内的上下留白（px） */
    yInset: 2,
    /** 当前高亮港口 / 无筛选时的透明度 */
    activeOpacity: 0.82,
    /** 非高亮港口时的透明度 */
    inactiveOpacity: 0.2,
    /** 背景区块边框宽度（px） */
    strokeWidth: 0.8
  },

  /**
   * 渐变与线型细节
   */
  drawing: {
    /** ETD 线虚线样式 */
    etdDashArray: '4 3',
    /** 中转连线虚线样式 */
    transshipDashArray: '0,0',
    /** 非装卸事件（航行/等待/收尾）统一水平实线宽度（px） */
    nonCargoLineWidth: 1.2
  }
} as const
