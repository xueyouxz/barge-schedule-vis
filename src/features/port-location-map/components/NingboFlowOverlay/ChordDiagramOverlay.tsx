import { useMemo, useState, useCallback } from 'react'
import { chord, arc, descending } from 'd3'
import { resolvePortColor } from '@/shared/lib/portColors'
import { useTheme } from '@/shared/theme'
import { usePortLocations } from '@/shared/hooks/usePortLocations'
import { FlowTooltip, type FlowTooltipState } from './FlowTooltip'
import type { NingboTerminalId } from '../../constants/terminalConfig'
import type { TerminalPixelMap } from '../../hooks/useNingboTerminalProjection'
import styles from './ChordDiagramOverlay.module.css'

interface ChordDiagramOverlayProps {
  matrix: number[][]
  terminals: NingboTerminalId[]
  pixelMap: TerminalPixelMap
  centerX: number
  centerY: number
  outerRadius: number
  transportCount: number
  selfCount: number
}

// ── Layout constants ─────────────────────────────────────────────────────────
/** 弧段之间的间距角（弧度），增大可让各码头弧段更清晰分开 */
const PAD_ANGLE = 0.28
const INNER_RATIO = 0.88
const LABEL_GAP = 14
const CTRL_SCALE = 0.32
/** 贝塞尔曲线统一线宽（px） */
const CHORD_STROKE_WIDTH = 1.5
/** 贝塞尔曲线基础透明度 */
const CHORD_OPACITY = 0.55
/** hover 时透明度 */
const CHORD_OPACITY_HOVER = 0.9
/** 目标节点圆半径（px），与弧段厚度视觉适配 */
const NODE_RADIUS = 5
/** hover 时节点半径 */
const NODE_RADIUS_HOVER = 7

// ── Geometry helpers ─────────────────────────────────────────────────────────

function d3AngleToSvg(angle: number): number {
  return angle - Math.PI / 2
}

function midPoint(startAngle: number, endAngle: number, r: number): { x: number; y: number } {
  const mid = d3AngleToSvg((startAngle + endAngle) / 2)
  return { x: Math.cos(mid) * r, y: Math.sin(mid) * r }
}

function buildChordArc(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  scale = CTRL_SCALE
): string {
  const cx = ((p0.x + p1.x) / 2) * scale
  const cy = ((p0.y + p1.y) / 2) * scale
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
}

// ── Tooltip default ──────────────────────────────────────────────────────────
const HIDDEN_TOOLTIP: FlowTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  sourceName: '',
  sourceId: '',
  targetName: '',
  targetId: '',
  count: 0,
  isSelf: false
}

// ─────────────────────────────────────────────────────────────────────────────
export function ChordDiagramOverlay({
  matrix,
  terminals,
  centerX,
  centerY,
  outerRadius,
  transportCount: _transportCount,
  selfCount: _selfCount
}: ChordDiagramOverlayProps) {
  const { theme } = useTheme()
  const { data: portLocations } = usePortLocations()
  const [tooltip, setTooltip] = useState<FlowTooltipState>(HIDDEN_TOOLTIP)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const innerRadius = outerRadius * INNER_RATIO
  /** 外圈弧段厚度（px） */
  const arcThickness = outerRadius - innerRadius

  // 只保留跨码头（非对角线）流量的矩阵，驱动 d3 chord layout
  const crossMatrix = useMemo(() => {
    if (!matrix.length) return matrix
    return matrix.map((row, i) => row.map((val, j) => (i === j ? 0 : val)))
  }, [matrix])

  const chordData = useMemo(() => {
    if (!crossMatrix.length || !terminals.length) return null
    return chord().padAngle(PAD_ANGLE).sortSubgroups(descending)(crossMatrix)
  }, [crossMatrix, terminals])

  const arcGen = useMemo(
    () =>
      arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(d => d.startAngle)
        .endAngle(d => d.endAngle),
    [innerRadius, outerRadius]
  )

  const handleArcEnter = useCallback(
    (srcIdx: number, tgtIdx: number, count: number, e: React.MouseEvent) => {
      const srcId = terminals[srcIdx]
      const tgtId = terminals[tgtIdx]
      if (!srcId || !tgtId) return
      const srcName = portLocations.find(p => p.code === srcId)?.name ?? srcId
      const tgtName = portLocations.find(p => p.code === tgtId)?.name ?? tgtId
      setHoveredKey(`${srcIdx}-${tgtIdx}`)
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        sourceId: srcId,
        sourceName: srcName,
        targetId: tgtId,
        targetName: tgtName,
        count,
        isSelf: false
      })
    },
    [terminals, portLocations]
  )

  const handleArcMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))
  }, [])

  const handleArcLeave = useCallback(() => {
    setHoveredKey(null)
    setTooltip(HIDDEN_TOOLTIP)
  }, [])

  if (!chordData || !terminals.length) return null

  return (
    <>
      <g transform={`translate(${centerX},${centerY})`} className={styles.root}>
        {/* ── 内部贝塞尔曲线（先渲染，外圈弧段覆盖在上） */}
        {chordData.map(c => {
          const srcId = terminals[c.source.index]
          if (!srcId) return null

          // 只显示跨码头转运弧段
          if (c.source.index === c.target.index) return null

          const tgtId = terminals[c.target.index]
          if (!tgtId) return null

          const srcColor = resolvePortColor(srcId, theme)
          const tgtColor = resolvePortColor(tgtId, theme)
          const chordKey = `${c.source.index}-${c.target.index}`
          const isHovered = hoveredKey === chordKey
          const count = c.source.value

          const p0 = midPoint(c.source.startAngle, c.source.endAngle, innerRadius)
          const p1 = midPoint(c.target.startAngle, c.target.endAngle, innerRadius)

          const pathD = buildChordArc(p0, p1)

          // 目标节点坐标：放置在外圈弧段中点（outerRadius 处），与各码头弧段中点对齐
          const tgtMidAngle = d3AngleToSvg((c.target.startAngle + c.target.endAngle) / 2)
          // 节点放在弧段正中央（innerRadius + arcThickness/2）
          const nodeR = innerRadius + arcThickness / 2
          const nodeX = Math.cos(tgtMidAngle) * nodeR
          const nodeY = Math.sin(tgtMidAngle) * nodeR

          const nodeRadius = isHovered ? NODE_RADIUS_HOVER : NODE_RADIUS
          const opacity = isHovered ? CHORD_OPACITY_HOVER : CHORD_OPACITY

          return (
            <g key={chordKey} style={{ pointerEvents: 'auto' }}>
              {/* 透明宽路径，扩大 hover 触发区域 */}
              <path
                d={pathD}
                fill='none'
                stroke='transparent'
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => handleArcEnter(c.source.index, c.target.index, count, e)}
                onMouseMove={handleArcMove}
                onMouseLeave={handleArcLeave}
              />
              {/* 贝塞尔曲线：统一线宽，颜色取源码头 */}
              <path
                d={pathD}
                fill='none'
                stroke={srcColor}
                strokeWidth={CHORD_STROKE_WIDTH}
                strokeOpacity={opacity}
                strokeLinecap='round'
                className={styles.chordArc}
                style={{ pointerEvents: 'none' }}
              />
              {/* 目标码头节点：圆形，颜色映射目标码头 */}
              <circle
                cx={nodeX}
                cy={nodeY}
                r={nodeRadius}
                fill={tgtColor}
                fillOpacity={isHovered ? 0.95 : 0.75}
                stroke={tgtColor}
                strokeWidth={1}
                strokeOpacity={0.4}
                className={styles.targetNode}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          )
        })}

        {/* ── 外圈弧段（后渲染，覆盖在曲线之上） */}
        {chordData.groups.map(group => {
          const termId = terminals[group.index]
          if (!termId) return null
          // 无跨码头流量的码头不渲染外圈弧段
          if (group.value === 0) return null
          const color = resolvePortColor(termId, theme)
          const midAngle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2
          const labelR = outerRadius + LABEL_GAP
          const lx = Math.cos(midAngle) * labelR
          const ly = Math.sin(midAngle) * labelR
          const anchor = lx > 1 ? 'start' : lx < -1 ? 'end' : 'middle'

          return (
            <g key={termId}>
              {/* 弧段底色 */}
              <path d={arcGen(group) ?? ''} fill={color} stroke='none' opacity={0.9} />
              {/* 码头 ID 标签 */}
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline='middle'
                className={styles.arcLabel}
                style={{ fill: color }}
              >
                {termId}
              </text>
            </g>
          )
        })}
      </g>

      <FlowTooltip state={tooltip} />
    </>
  )
}
