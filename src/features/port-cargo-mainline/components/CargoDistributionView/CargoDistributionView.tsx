import { useState, useMemo, useCallback } from 'react'
import { ViewStateOverlay } from '@/shared/components/ViewStateOverlay/ViewStateOverlay'
import { resolvePortColor } from '@/shared/lib/portColors'
import { useTheme } from '@/shared/theme'
import { useCargoDistributionData } from './hooks/useCargoDistributionData'
import type { CargoDistributionViewProps, DistributionNode, TypeSlice } from './types'
import { BOT_Y, BEZ_CTRL, CANVAS_H, CANVAS_W, CARGO_TYPE_LABELS, TOP_Y } from './config'
import styles from './CargoDistributionView.module.css'

// ─── 货物类型主题色（适配亮/暗主题） ────────────────────────────────────────
const CARGO_COLORS_LIGHT: Record<string, string> = {
  heavy: '#2f6db2',
  empty: '#8a949e',
  danger: '#d94f5c'
}
const CARGO_COLORS_DARK: Record<string, string> = {
  heavy: '#71a7e2',
  empty: '#808c97',
  danger: '#f26c78'
}

// ─── SVG 几何工具 ────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, sa: number, ea: number): string {
  const s = polar(cx, cy, r, sa)
  const e = polar(cx, cy, r, ea)
  const large = ea - sa > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`
}

// ─── 子组件：饼图节点 ────────────────────────────────────────────────────────

interface PieProps {
  cx: number
  cy: number
  r: number
  slices: TypeSlice[]
  total: number
  ringColor: string
  dimmed: boolean
  cargoColors: Record<string, string>
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function PieNode({
  cx,
  cy,
  r,
  slices,
  total,
  ringColor,
  dimmed,
  cargoColors,
  onMouseEnter,
  onMouseLeave
}: PieProps) {
  let angle = -Math.PI / 2
  const arcs = slices.map(s => {
    const sweep = (s.v / total) * Math.PI * 2
    const result = { ...s, sa: angle, ea: angle + sweep }
    angle += sweep
    return result
  })

  return (
    <g
      className={styles.pieNode}
      style={{ opacity: dimmed ? 0.08 : 1 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 阴影 */}
      <circle cx={cx} cy={cy + 2} r={r + 1.5} fill='rgba(0,0,0,0.06)' />
      {/* 目的港颜色外环 */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 3.5}
        fill='none'
        stroke={ringColor}
        strokeWidth={2.2}
        opacity={0.55}
      />
      {/* 货物类型饼图切片 */}
      {arcs.map((a, i) => (
        <path
          key={i}
          d={arcPath(cx, cy, r, a.sa, a.ea)}
          fill={cargoColors[a.t] ?? '#ccc'}
          stroke='var(--cargo-dist-separator)'
          strokeWidth={1.3}
        />
      ))}
      {/* 中心点 */}
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill='var(--cargo-dist-center-dot)'
        stroke='var(--cargo-dist-separator)'
        strokeWidth={1}
      />
    </g>
  )
}

// ─── 子组件：贝塞尔连线 ──────────────────────────────────────────────────────

interface BezierLineProps {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  opacity: number
  width: number
}

function BezierLine({ x1, y1, x2, y2, color, opacity, width }: BezierLineProps) {
  const dy = y2 - y1
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${y1 + dy * BEZ_CTRL}, ${x2} ${y2 - dy * BEZ_CTRL}, ${x2} ${y2}`}
      fill='none'
      stroke={color}
      strokeWidth={width}
      opacity={opacity}
      className={styles.bezierLine}
    />
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function CargoDistributionView({
  csvFiles,
  dataMode = 'input'
}: CargoDistributionViewProps) {
  const { theme } = useTheme()
  const cargoColors = theme === 'dark' ? CARGO_COLORS_DARK : CARGO_COLORS_LIGHT

  const { origins, destinations, nodes, hulls, loading, error } = useCargoDistributionData(
    dataMode,
    csvFiles
  )

  // hover 状态：节点 key / 起运港 / 目的港
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoveredOrigin, setHoveredOrigin] = useState<string | null>(null)
  const [hoveredDest, setHoveredDest] = useState<string | null>(null)

  const clearHover = useCallback(() => {
    setHoveredKey(null)
    setHoveredOrigin(null)
    setHoveredDest(null)
  }, [])

  // 位置计算
  const oSpacing = CANVAS_W / (Math.max(1, origins.length) + 1)
  const dSpacing = CANVAS_W / (Math.max(1, destinations.length) + 1)

  const oPos = useMemo(
    () => Object.fromEntries(origins.map((o, i) => [o, { x: oSpacing * (i + 1), y: TOP_Y }])),
    [origins, oSpacing]
  )
  const dPos = useMemo(
    () => Object.fromEntries(destinations.map((d, i) => [d, { x: dSpacing * (i + 1), y: BOT_Y }])),
    [destinations, dSpacing]
  )

  // ── highlight 辅助函数 ────────────────────────────────────────────────────
  const getNodeHighlight = useCallback(
    (n: DistributionNode): boolean | null => {
      if (!hoveredKey && !hoveredOrigin && !hoveredDest) return null
      if (hoveredKey) return n.key === hoveredKey
      if (hoveredOrigin) return n.origin === hoveredOrigin
      if (hoveredDest) return n.dest === hoveredDest
      return null
    },
    [hoveredKey, hoveredOrigin, hoveredDest]
  )

  const getNodeDimmed = useCallback(
    (n: DistributionNode): boolean => {
      const h = getNodeHighlight(n)
      return h !== null && !h
    },
    [getNodeHighlight]
  )

  const getBezOpacity = useCallback(
    (n: DistributionNode): number => {
      if (!hoveredKey && !hoveredOrigin && !hoveredDest) return 0.2
      const h = getNodeHighlight(n)
      if (h === null) return 0.2
      return h ? 0.75 : 0.02
    },
    [getNodeHighlight, hoveredKey, hoveredOrigin, hoveredDest]
  )

  const getTopBezOpacity = useCallback(
    (origin: string): number => {
      if (!hoveredKey && !hoveredOrigin && !hoveredDest) return 0.22
      if (hoveredOrigin) return hoveredOrigin === origin ? 0.5 : 0.02
      if (hoveredKey?.startsWith(origin + ':')) return 0.5
      if (hoveredDest)
        return nodes.some(n => n.origin === origin && n.dest === hoveredDest) ? 0.35 : 0.02
      return 0.02
    },
    [hoveredKey, hoveredOrigin, hoveredDest, nodes]
  )

  const getHullOpacity = useCallback(
    (origin: string): number => {
      if (!hoveredKey && !hoveredOrigin && !hoveredDest) return 0.6
      if (hoveredOrigin) return hoveredOrigin === origin ? 0.8 : 0.08
      if (hoveredKey?.startsWith(origin + ':')) return 0.8
      return 0.25
    },
    [hoveredKey, hoveredOrigin, hoveredDest]
  )

  if (loading || error || (nodes.length === 0 && !loading)) {
    return (
      <ViewStateOverlay
        loading={loading}
        error={error ? `加载失败：${error}` : null}
        empty={!loading && !error && nodes.length === 0}
      />
    )
  }

  return (
    <div className={styles.container}>
      {/* 图例 */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>货物类型</span>
        {Object.entries(CARGO_TYPE_LABELS).map(([key, label]) => (
          <div key={key} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: cargoColors[key] }} />
            <span className={styles.legendText}>{label}</span>
          </div>
        ))}
        <span className={styles.legendSep} />
        <span className={styles.legendLabel}>目标码头</span>
        {destinations.map(d => (
          <div
            key={d}
            className={styles.legendItem}
            style={{ opacity: hoveredDest && hoveredDest !== d ? 0.2 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setHoveredDest(d)}
            onMouseLeave={() => setHoveredDest(null)}
          >
            <span
              className={styles.legendRing}
              style={{ borderColor: resolvePortColor(d, theme) }}
            />
            <span className={styles.legendText}>{d}</span>
          </div>
        ))}
      </div>

      {/* SVG 主图 */}
      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        className={styles.svg}
        aria-label='货物分布力导向图'
      >
        {/* 上方横线（起运港轨道） */}
        <line x1={42} y1={TOP_Y} x2={CANVAS_W - 42} y2={TOP_Y} className={styles.trackLine} />

        {/* 起运港节点 */}
        {origins.map(o => {
          const p = oPos[o]
          if (!p) return null
          const active = !hoveredOrigin || hoveredOrigin === o
          const isHovered = hoveredOrigin === o
          return (
            <g
              key={o}
              className={styles.portNode}
              style={{ opacity: active ? 1 : 0.12 }}
              onMouseEnter={() => setHoveredOrigin(o)}
              onMouseLeave={() => setHoveredOrigin(null)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={8}
                className={styles.portOuterRing}
                stroke={isHovered ? 'var(--cargo-dist-accent)' : 'var(--cargo-dist-port-ring)'}
                strokeWidth={isHovered ? 2.8 : 1.5}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={3}
                fill={isHovered ? 'var(--cargo-dist-accent)' : 'var(--cargo-dist-port-dot)'}
              />
              <text
                x={p.x}
                y={p.y - 17}
                textAnchor='middle'
                className={styles.portLabel}
                fill={isHovered ? 'var(--cargo-dist-accent)' : undefined}
              >
                {o}
              </text>
            </g>
          )
        })}

        {/* 下方横线（目的港轨道） */}
        <line x1={42} y1={BOT_Y} x2={CANVAS_W - 42} y2={BOT_Y} className={styles.trackLine} />

        {/* 目的港节点 */}
        {destinations.map(d => {
          const p = dPos[d]
          if (!p) return null
          const destColor = resolvePortColor(d, theme)
          const active = !hoveredDest || hoveredDest === d
          const isHovered = hoveredDest === d
          return (
            <g
              key={d}
              className={styles.portNode}
              style={{ opacity: active ? 1 : 0.12 }}
              onMouseEnter={() => setHoveredDest(d)}
              onMouseLeave={() => setHoveredDest(null)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={8}
                className={styles.portOuterRing}
                stroke={isHovered ? destColor : 'var(--cargo-dist-port-ring)'}
                strokeWidth={isHovered ? 2.8 : 1.5}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={3}
                fill={isHovered ? destColor : 'var(--cargo-dist-port-dot)'}
              />
              <text
                x={p.x}
                y={p.y + 24}
                textAnchor='middle'
                className={styles.portLabel}
                fill={isHovered ? destColor : undefined}
              >
                {d}
              </text>
            </g>
          )
        })}

        {/* 分组椭圆轮廓 */}
        {hulls.map(h => (
          <ellipse
            key={`hull-${h.origin}`}
            cx={h.cx}
            cy={h.cy}
            rx={h.rx + 6}
            ry={h.ry + 6}
            fill='none'
            className={styles.hullEllipse}
            style={{ opacity: getHullOpacity(h.origin) }}
          />
        ))}

        {/* 分组标签（椭圆顶部） */}
        {hulls.map(h => {
          const active = !hoveredOrigin || hoveredOrigin === h.origin
          return (
            <text
              key={`hull-label-${h.origin}`}
              x={h.cx}
              y={h.top - 7}
              textAnchor='middle'
              className={styles.hullLabel}
              style={{ opacity: active ? 1 : 0.1 }}
            >
              {h.origin}
            </text>
          )
        })}

        {/* 起运港 → 分组中心 贝塞尔连线（上方） */}
        {hulls.map(h => {
          const p = oPos[h.origin]
          if (!p) return null
          return (
            <BezierLine
              key={`top-bez-${h.origin}`}
              x1={p.x}
              y1={p.y + 8}
              x2={h.cx}
              y2={h.top - 1}
              color='var(--cargo-dist-bez-muted)'
              opacity={getTopBezOpacity(h.origin)}
              width={1.3}
            />
          )
        })}

        {/* 节点 → 目的港 贝塞尔连线（下方） */}
        {nodes.map(n => {
          const p = dPos[n.dest]
          if (!p) return null
          return (
            <BezierLine
              key={`bot-bez-${n.key}`}
              x1={n.x}
              y1={n.y + n.r + 3}
              x2={p.x}
              y2={p.y - 8}
              color={resolvePortColor(n.dest, theme)}
              opacity={getBezOpacity(n)}
              width={Math.max(1.1, Math.min(2.8, n.total / 55))}
            />
          )
        })}

        {/* 饼图气泡节点 */}
        {nodes.map(n => (
          <PieNode
            key={n.key}
            cx={n.x}
            cy={n.y}
            r={n.r}
            slices={n.slices}
            total={n.total}
            ringColor={resolvePortColor(n.dest, theme)}
            dimmed={getNodeDimmed(n)}
            cargoColors={cargoColors}
            onMouseEnter={() => setHoveredKey(n.key)}
            onMouseLeave={clearHover}
          />
        ))}

        {/* 节点标签（目的港 + 箱数） */}
        {nodes.map(n => {
          const dimmed = getNodeDimmed(n)
          return (
            <g
              key={`label-${n.key}`}
              style={{ opacity: dimmed ? 0.06 : 1, pointerEvents: 'none' }}
              className={styles.nodeLabel}
            >
              <text
                x={n.x}
                y={n.y - n.r - 9}
                textAnchor='middle'
                className={styles.destLabel}
                fill={resolvePortColor(n.dest, theme)}
              >
                → {n.dest}
              </text>
              <text x={n.x} y={n.y + n.r + 16} textAnchor='middle' className={styles.countLabel}>
                {n.total}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
