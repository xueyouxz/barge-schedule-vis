import { useState, useCallback, useMemo } from 'react'
import { resolvePortColor } from '@/shared/lib/portColors'
import { useTheme } from '@/shared/theme'
import { usePortLocations } from '@/shared/hooks/usePortLocations'
import { FlowTooltip, type FlowTooltipState } from './FlowTooltip'
import type { NingboTerminalId } from '../../constants/terminalConfig'
import type { TransportFlow } from '../../hooks/useTransportFlowData'
import type { TerminalPixelMap } from '../../hooks/useNingboTerminalProjection'
import styles from './FlowLineOverlay.module.css'

interface FlowLineOverlayProps {
  flows: TransportFlow[]
  pixelMap: TerminalPixelMap
}

interface ArcDatum {
  flow: TransportFlow
  srcPx: { x: number; y: number }
  tgtPx: { x: number; y: number }
  color: string
  count: number
  maxCount: number
  /** SVG cubic bezier path string */
  pathD: string
  /** label position */
  labelX: number
  labelY: number
  /** label offset direction (unit vector, perpendicular to chord) */
  normalX: number
  normalY: number
}

/** Map count → arc bend offset in pixels [12, 72] */
function countToOffset(count: number, maxCount: number): number {
  if (maxCount === 0) return 24
  const t = count / maxCount
  // square-root scale gives better visual differentiation
  return 12 + Math.sqrt(t) * 60
}

/** Map count → stroke width [1.2, 4.5] */
function countToStrokeWidth(count: number, maxCount: number): number {
  if (maxCount === 0) return 1.2
  const t = count / maxCount
  return 1.2 + t * 3.3
}

/**
 * Build a quadratic bezier SVG path from p0 to p1, with a perpendicular
 * control point offset scaled by `offset` pixels.
 * Returns { pathD, ctrlX, ctrlY } where ctrl is the bezier control point.
 */
function buildArcPath(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  offset: number
): { pathD: string; ctrlX: number; ctrlY: number } {
  const mx = (p0.x + p1.x) / 2
  const my = (p0.y + p1.y) / 2
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) {
    return { pathD: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`, ctrlX: mx, ctrlY: my }
  }
  // Perpendicular unit vector (rotated 90° clockwise)
  const nx = dy / len
  const ny = -dx / len
  const ctrlX = mx + nx * offset
  const ctrlY = my + ny * offset
  const pathD = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} Q ${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
  return { pathD, ctrlX, ctrlY }
}

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

/**
 * SVG arc overlay for high-zoom cargo flow between terminals.
 * Renders bezier curves scaled by flow volume with count labels.
 */
export function FlowLineOverlay({ flows, pixelMap }: FlowLineOverlayProps) {
  const { theme } = useTheme()
  const { data: portLocations } = usePortLocations()
  const [tooltip, setTooltip] = useState<FlowTooltipState>(HIDDEN_TOOLTIP)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const interFlows = useMemo(() => flows.filter(f => f.source !== f.target), [flows])

  const maxCount = useMemo(
    () => (interFlows.length ? Math.max(...interFlows.map(f => f.count)) : 0),
    [interFlows]
  )

  const arcs = useMemo((): ArcDatum[] => {
    return interFlows.flatMap(flow => {
      const srcPx = pixelMap.get(flow.source as NingboTerminalId)
      const tgtPx = pixelMap.get(flow.target as NingboTerminalId)
      if (!srcPx || !tgtPx) return []

      const offset = countToOffset(flow.count, maxCount)
      const { pathD } = buildArcPath(srcPx, tgtPx, offset)
      const color = resolvePortColor(flow.source, theme)

      // Label sits at chord midpoint, pushed outward from chord by LABEL_PUSH
      const dx = srcPx.x - tgtPx.x
      const dy = srcPx.y - tgtPx.y
      const len = Math.sqrt(dx * dx + dy * dy)
      const nx = len > 0 ? dy / len : 0
      const ny = len > 0 ? -dx / len : -1
      // Push label 14px further out beyond the arc apex
      const LABEL_PUSH = offset + 14
      const mx2 = (srcPx.x + tgtPx.x) / 2
      const my2 = (srcPx.y + tgtPx.y) / 2

      return [
        {
          flow,
          srcPx,
          tgtPx,
          color,
          count: flow.count,
          maxCount,
          pathD,
          labelX: mx2 + nx * LABEL_PUSH,
          labelY: my2 + ny * LABEL_PUSH,
          normalX: nx,
          normalY: ny
        }
      ]
    })
  }, [interFlows, pixelMap, maxCount, theme])

  const handleEnter = useCallback(
    (arc: ArcDatum, e: React.MouseEvent) => {
      const key = `${arc.flow.source}-${arc.flow.target}`
      const srcName = portLocations.find(p => p.code === arc.flow.source)?.name ?? arc.flow.source
      const tgtName = portLocations.find(p => p.code === arc.flow.target)?.name ?? arc.flow.target
      setHoveredKey(key)
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        sourceId: arc.flow.source,
        sourceName: srcName,
        targetId: arc.flow.target,
        targetName: tgtName,
        count: arc.count,
        isSelf: false
      })
    },
    [portLocations]
  )

  const handleMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))
  }, [])

  const handleLeave = useCallback(() => {
    setHoveredKey(null)
    setTooltip(HIDDEN_TOOLTIP)
  }, [])

  if (!arcs.length) return null

  return (
    <>
      {arcs.map(a => {
        const key = `${a.flow.source}-${a.flow.target}`
        const isHovered = hoveredKey === key
        const sw = countToStrokeWidth(a.count, maxCount)

        // Percent label: fraction of max, or just the raw count
        const pct =
          maxCount > 0
            ? `${((a.count / arcs.reduce((s, x) => s + x.count, 0)) * 100).toFixed(0)}%`
            : ''

        return (
          <g key={key} style={{ pointerEvents: 'auto' }}>
            {/* Hit area — wider invisible path for easier hover */}
            <path
              d={a.pathD}
              fill='none'
              stroke='transparent'
              strokeWidth={Math.max(sw + 10, 14)}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => handleEnter(a, e)}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
            />
            {/* Visible arc */}
            <path
              d={a.pathD}
              fill='none'
              stroke={a.color}
              strokeWidth={isHovered ? sw + 1.5 : sw}
              strokeOpacity={isHovered ? 0.95 : 0.7}
              strokeLinecap='round'
              style={{
                pointerEvents: 'none',
                transition: 'stroke-width 0.12s ease, stroke-opacity 0.12s ease'
              }}
            />
            {/* Arrow marker near target */}
            <circle
              cx={a.tgtPx.x}
              cy={a.tgtPx.y}
              r={isHovered ? 4 : 2.8}
              fill={a.color}
              fillOpacity={isHovered ? 0.95 : 0.65}
              style={{ pointerEvents: 'none', transition: 'r 0.12s ease' }}
            />
            {/* Count label */}
            <text
              x={a.labelX}
              y={a.labelY}
              className={styles.arcLabel}
              style={{ fill: a.color }}
              textAnchor='middle'
              dominantBaseline='middle'
            >
              {a.count.toLocaleString()}
            </text>
            {/* Percentage label (smaller, below count) */}
            {pct && (
              <text
                x={a.labelX}
                y={a.labelY + 13}
                className={styles.arcLabelSub}
                style={{ fill: a.color }}
                textAnchor='middle'
                dominantBaseline='middle'
              >
                {pct}
              </text>
            )}
          </g>
        )
      })}
      <FlowTooltip state={tooltip} />
    </>
  )
}
