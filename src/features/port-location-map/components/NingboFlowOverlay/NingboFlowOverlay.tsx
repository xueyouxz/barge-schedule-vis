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

/** 根据 zoom 在 [FLOW_ZOOM_MIN, CHORD_ZOOM_MAX] 区间内线性插值弦图半径 [72, 152] px */
function interpolateRadius(zoom: number): number {
  const t = Math.max(0, Math.min(1, (zoom - FLOW_ZOOM_MIN) / (CHORD_ZOOM_MAX - FLOW_ZOOM_MIN)))
  return 72 + t * 80
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
