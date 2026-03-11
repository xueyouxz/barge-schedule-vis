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
const PAD_ANGLE = 0.035
const INNER_RATIO = 0.95
const TICK_OUTER_GAP = 8
const LABEL_GAP = 14
const CTRL_SCALE = 0.32
/** 每条流在源/目标码头弧段上占据的最小弧长（弧度）。 */
const MIN_SEGMENT_ANGLE = 0.15
/** 子区间分割线：从 innerRadius 向外延伸的长度（px） */
const DIVIDER_LEN = 15

// ── Geometry helpers ─────────────────────────────────────────────────────────

function d3AngleToSvg(angle: number): number {
  return angle - Math.PI / 2
}

function midPoint(startAngle: number, endAngle: number, r: number): { x: number; y: number } {
  const mid = d3AngleToSvg((startAngle + endAngle) / 2)
  return { x: Math.cos(mid) * r, y: Math.sin(mid) * r }
}

function clampSegment(
  startAngle: number,
  endAngle: number
): { startAngle: number; endAngle: number } {
  const span = endAngle - startAngle
  if (span >= MIN_SEGMENT_ANGLE) return { startAngle, endAngle }
  const mid = (startAngle + endAngle) / 2
  const half = MIN_SEGMENT_ANGLE / 2
  return { startAngle: mid - half, endAngle: mid + half }
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

function buildSelfLoop(p: { x: number; y: number }, r: number): string {
  const loopR = r * 0.22
  const nx = p.x / r
  const ny = p.y / r
  const cx1 = p.x + nx * loopR + ny * loopR * 0.5
  const cy1 = p.y + ny * loopR - nx * loopR * 0.5
  const cx2 = p.x + nx * loopR - ny * loopR * 0.5
  const cy2 = p.y + ny * loopR + nx * loopR * 0.5
  return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} C ${cx1.toFixed(2)} ${cy1.toFixed(2)} ${cx2.toFixed(2)} ${cy2.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
}

function bezierMid(
  p0: { x: number; y: number },
  ctrl: { x: number; y: number },
  p1: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: 0.25 * p0.x + 0.5 * ctrl.x + 0.25 * p1.x,
    y: 0.25 * p0.y + 0.5 * ctrl.y + 0.25 * p1.y
  }
}

function countToStroke(count: number, maxCount: number): number {
  if (maxCount === 0) return 1
  return 1 + (count / maxCount) * 4
}

function countToOpacity(count: number, maxCount: number): number {
  if (maxCount === 0) return 0.45
  return 0.35 + (count / maxCount) * 0.5
}

/** 从 d3 angle 计算弧上坐标（给定半径） */
function angleToPoint(angle: number, r: number): { x: number; y: number } {
  const a = d3AngleToSvg(angle)
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
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
  transportCount,
  selfCount
}: ChordDiagramOverlayProps) {
  const { theme } = useTheme()
  const { data: portLocations } = usePortLocations()
  const [tooltip, setTooltip] = useState<FlowTooltipState>(HIDDEN_TOOLTIP)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const innerRadius = outerRadius * INNER_RATIO

  const chordData = useMemo(() => {
    if (!matrix.length || !terminals.length) return null
    return chord().padAngle(PAD_ANGLE).sortSubgroups(descending)(matrix)
  }, [matrix, terminals])

  const arcGen = useMemo(
    () =>
      arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(d => d.startAngle)
        .endAngle(d => d.endAngle),
    [innerRadius, outerRadius]
  )

  const maxCount = useMemo(() => {
    if (!chordData) return 1
    return Math.max(...chordData.map(c => c.source.value), 1)
  }, [chordData])

  /**
   * 按 group index 收集每条 chord 在该 group 上的子区间边界角度。
   * 只收集内部边界（排除 group 的 startAngle/endAngle 本身），
   * 用于在弧段上绘制分割线。
   */
  const segmentDividers = useMemo(() => {
    if (!chordData) return new Map<number, number[]>()
    const map = new Map<number, Set<number>>()

    for (const c of chordData) {
      // source 侧
      const si = c.source.index
      if (!map.has(si)) map.set(si, new Set())
      const srcSeg = clampSegment(c.source.startAngle, c.source.endAngle)
      map.get(si)!.add(srcSeg.startAngle)
      map.get(si)!.add(srcSeg.endAngle)

      // target 侧
      const ti = c.target.index
      if (!map.has(ti)) map.set(ti, new Set())
      const tgtSeg = clampSegment(c.target.startAngle, c.target.endAngle)
      map.get(ti)!.add(tgtSeg.startAngle)
      map.get(ti)!.add(tgtSeg.endAngle)
    }

    // 转成 Map<groupIndex, number[]>，去除 group 本身的首尾端点（只保留内部边界）
    const result = new Map<number, number[]>()
    for (const group of chordData.groups) {
      const angles = map.get(group.index)
      if (!angles) continue
      const EPS = 1e-6
      const inner = [...angles].filter(a => a > group.startAngle + EPS && a < group.endAngle - EPS)
      result.set(group.index, inner)
    }
    return result
  }, [chordData])

  const handleArcEnter = useCallback(
    (srcIdx: number, tgtIdx: number, count: number, isSelf: boolean, e: React.MouseEvent) => {
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
        isSelf
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

          const color = resolvePortColor(srcId, theme)
          const chordKey = `${c.source.index}-${c.target.index}`
          const isHovered = hoveredKey === chordKey
          const count = c.source.value
          const isSelf = c.source.index === c.target.index

          const srcSeg = clampSegment(c.source.startAngle, c.source.endAngle)
          const tgtSeg = clampSegment(c.target.startAngle, c.target.endAngle)
          const p0 = midPoint(srcSeg.startAngle, srcSeg.endAngle, innerRadius)
          const p1 = midPoint(tgtSeg.startAngle, tgtSeg.endAngle, innerRadius)

          const sw = countToStroke(count, maxCount)
          const op = countToOpacity(count, maxCount)

          const pathD = isSelf ? buildSelfLoop(p0, innerRadius) : buildChordArc(p0, p1)

          const ctrlPt = {
            x: ((p0.x + p1.x) / 2) * CTRL_SCALE,
            y: ((p0.y + p1.y) / 2) * CTRL_SCALE
          }
          const rawMid = isSelf ? { x: p0.x * 1.3, y: p0.y * 1.3 } : bezierMid(p0, ctrlPt, p1)
          const midLen = Math.sqrt(rawMid.x ** 2 + rawMid.y ** 2) || 1
          const labelX = rawMid.x - (rawMid.x / midLen) * 8
          const labelY = rawMid.y - (rawMid.y / midLen) * 8

          return (
            <g key={chordKey} style={{ pointerEvents: 'auto' }}>
              <path
                d={pathD}
                fill='none'
                stroke='transparent'
                strokeWidth={Math.max(sw + 10, 12)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => handleArcEnter(c.source.index, c.target.index, count, isSelf, e)}
                onMouseMove={handleArcMove}
                onMouseLeave={handleArcLeave}
              />
              <path
                d={pathD}
                fill='none'
                stroke={color}
                strokeWidth={isHovered ? sw + 1.5 : sw}
                strokeOpacity={isHovered ? Math.min(op + 0.2, 1) : op}
                strokeLinecap='round'
                className={styles.chordArc}
                style={{ pointerEvents: 'none' }}
              />
              {!isSelf && (
                <circle
                  cx={p1.x}
                  cy={p1.y}
                  r={isHovered ? 3.5 : 2.2}
                  fill={color}
                  fillOpacity={isHovered ? 0.9 : 0.6}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <text
                x={labelX}
                y={labelY}
                className={styles.chordLabel}
                style={{ fill: color, opacity: isHovered ? 1 : 0.82 }}
                textAnchor='middle'
                dominantBaseline='middle'
              >
                {count.toLocaleString()}
              </text>
            </g>
          )
        })}

        {/* ── 外圈弧段（后渲染，覆盖在曲线之上） */}
        {chordData.groups.map(group => {
          const termId = terminals[group.index]
          if (!termId) return null
          const color = resolvePortColor(termId, theme)
          const midAngle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2
          const tickR = outerRadius + TICK_OUTER_GAP
          const labelR = outerRadius + LABEL_GAP
          const lx = Math.cos(midAngle) * labelR
          const ly = Math.sin(midAngle) * labelR
          const anchor = lx > 1 ? 'start' : lx < -1 ? 'end' : 'middle'
          // 该 group 下各子区间的内部边界角度
          const dividerAngles = segmentDividers.get(group.index) ?? []

          return (
            <g key={termId}>
              {/* 弧段底色 */}
              <path
                d={arcGen(group) ?? ''}
                fill={color}
                stroke={color}
                strokeWidth={0.5}
                opacity={0.9}
              />
              {/*
                子区间分割线：在 innerRadius 到 innerRadius+DIVIDER_LEN 之间画径向短线。
                使用深背景色让分割线在彩色弧段上清晰可见。
              */}
              {dividerAngles.map(angle => {
                const inner = angleToPoint(angle, innerRadius)
                const outer = angleToPoint(angle, innerRadius + DIVIDER_LEN)
                return (
                  <line
                    key={angle}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    className={styles.segmentDivider}
                  />
                )
              })}
              {/* 码头中点刻度线 */}
              <line
                x1={Math.cos(midAngle) * (outerRadius + 2)}
                y1={Math.sin(midAngle) * (outerRadius + 2)}
                x2={Math.cos(midAngle) * tickR}
                y2={Math.sin(midAngle) * tickR}
                stroke={color}
                strokeWidth={1.5}
                opacity={0.6}
              />
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

        {/* ── 中心信息标注 */}
        <text y={-18} className={styles.centerLabel}>
          转码头率
        </text>
        <text y={2} className={styles.centerRate}>
          {transportCount + selfCount > 0
            ? `${((transportCount / (transportCount + selfCount)) * 100).toFixed(1)}%`
            : '--'}
        </text>
        <text y={17} className={styles.centerSub}>
          {transportCount.toLocaleString()}
          <tspan className={styles.centerSubMuted}>/</tspan>
          {(transportCount + selfCount).toLocaleString()}
          <tspan className={styles.centerSubMuted}> 筱</tspan>
        </text>
      </g>

      <FlowTooltip state={tooltip} />
    </>
  )
}
