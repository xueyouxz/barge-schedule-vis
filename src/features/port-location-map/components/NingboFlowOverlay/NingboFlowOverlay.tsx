import type { MapRef } from 'react-map-gl/maplibre'
import { FLOW_ZOOM_MIN, CHORD_ZOOM_MAX } from '../../constants/terminalConfig'
import { useTransportFlowData } from '../../hooks/useTransportFlowData'
import { useNingboTerminalProjection } from '../../hooks/useNingboTerminalProjection'
import { ChordDiagramOverlay } from './ChordDiagramOverlay'
import { FlowLineOverlay } from './FlowLineOverlay'
import styles from './NingboFlowOverlay.module.css'

interface NingboFlowOverlayProps {
  mapRef: React.RefObject<MapRef | null>
  zoom: number
  isMapReady: boolean
}

/**
 * 弦图半径随 zoom 线性插值。
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  用户可调参数（修改这两个值控制弦图大小范围）           │
 * │  CHORD_RADIUS_MIN  — zoom = FLOW_ZOOM_MIN 时的半径(px) │
 * │  CHORD_RADIUS_MAX  — zoom = CHORD_ZOOM_MAX 时的半径(px)│
 * └─────────────────────────────────────────────────────────┘
 */
const CHORD_RADIUS_MIN = 32 // ← 最小半径（px），zoom = 10 时
const CHORD_RADIUS_MAX = 72 // ← 最大半径（px），zoom = 12.5 时

function interpolateRadius(zoom: number): number {
  const t = Math.max(0, Math.min(1, (zoom - FLOW_ZOOM_MIN) / (CHORD_ZOOM_MAX - FLOW_ZOOM_MIN)))
  return CHORD_RADIUS_MIN + t * (CHORD_RADIUS_MAX - CHORD_RADIUS_MIN)
}

/**
 * 宁波港区转码头流量覆盖层（主控制器）。
 *
 * - zoom < FLOW_ZOOM_MIN (10)  → 不显示任何覆盖层
 * - zoom ∈ [10, 12.5)          → SVG 弦图（聚合可视化）
 * - zoom >= 12.5               → SVG 贝塞尔曲线连线（精细可视化，按流量大小调整弧度）
 */
export function NingboFlowOverlay({ mapRef, zoom, isMapReady }: NingboFlowOverlayProps) {
  const { flows, activeTerminals, matrix, transportCount, selfCount, isLoading } =
    useTransportFlowData()

  const { pixelMap, centerX, centerY } = useNingboTerminalProjection(mapRef, activeTerminals)

  // 无有效数据或正在加载时不渲染
  if (isLoading || !activeTerminals.length || (transportCount === 0 && selfCount === 0)) return null

  const showChord = zoom >= FLOW_ZOOM_MIN && zoom < CHORD_ZOOM_MAX
  const showLines = zoom >= CHORD_ZOOM_MAX && isMapReady

  return (
    <svg
      className={styles.svgOverlay}
      style={{
        opacity: showChord || showLines ? 1 : 0,
        pointerEvents: 'none'
      }}
      aria-hidden='true'
    >
      {/* ── 低 zoom：SVG 弦图（聚合可视化） */}
      {showChord && pixelMap.size > 0 && (
        <ChordDiagramOverlay
          matrix={matrix}
          terminals={activeTerminals}
          pixelMap={pixelMap}
          centerX={centerX}
          centerY={centerY}
          outerRadius={interpolateRadius(zoom)}
          transportCount={transportCount}
          selfCount={selfCount}
        />
      )}

      {/* ── 高 zoom：SVG 贝塞尔曲线（按流量弧度 + 外部标注） */}
      {showLines && pixelMap.size > 0 && <FlowLineOverlay flows={flows} pixelMap={pixelMap} />}
    </svg>
  )
}
