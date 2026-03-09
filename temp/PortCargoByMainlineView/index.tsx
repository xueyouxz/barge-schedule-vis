import { useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import styles from './style/index.module.css'
import { usePortCargoByMainlineData } from './hooks/usePortCargoByMainlineData'
import type { PortCargoByMainlineViewProps } from './types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { registerPortIds } from '@/store/colorMappingSlice'
import { resolvePortColor } from '@/constants/colorMapping'
import type { ContainerLoadType } from './types'
import {
  BLOCK_GAP,
  BLOCK_STYLE,
  CONTAINER_GRID,
  COUNT_LABEL_MIN_BLOCK_HEIGHT,
  COUNT_LABEL_MIN_BLOCK_WIDTH,
  DEFAULT_VIEW_SIZE,
  MIN_ROW_INNER_HEIGHT,
  PORT_LABEL_OFFSET,
  ROW_BAND_PADDING_INNER,
  ROW_DECORATION_STYLE,
  ROW_INNER_HEIGHT_FLOOR,
  ROW_INNER_HEIGHT_SHRINK,
  ROW_INNER_SAFE_GAP,
  VIEW_MARGIN,
} from './config'
import { useTheme } from '@/theme'

interface ContainerCell {
  x: number
  y: number
  width: number
  height: number
  type: ContainerLoadType
}

function buildContainerCells(
  containers: ContainerLoadType[],
  x: number,
  y: number,
  width: number,
  height: number
): ContainerCell[] {
  if (containers.length === 0 || width <= 0 || height <= 0) return []

  const { padding, gap, columnSearchScales } = CONTAINER_GRID
  const innerWidth = Math.max(0, width - padding * 2)
  const innerHeight = Math.max(0, height - padding * 2)

  if (innerWidth <= 0 || innerHeight <= 0) return []

  const count = containers.length
  const orderedContainers: ContainerLoadType[] = [
    ...containers.filter((type) => type === 'heavy'),
    ...containers.filter((type) => type === 'empty'),
  ]

  const approxCols = Math.max(
    1,
    Math.min(count, Math.floor(Math.sqrt((count * innerWidth) / Math.max(1, innerHeight))))
  )

  const candidateCols = new Set<number>([
    1,
    count,
    approxCols,
    Math.max(1, approxCols - 1),
    Math.min(count, approxCols + 1),
    ...columnSearchScales.map((scale) => {
      const candidate = approxCols * scale
      return scale >= 1
        ? Math.min(count, Math.ceil(candidate))
        : Math.max(1, Math.floor(candidate))
    }),
  ])

  let bestCols = 1
  let bestRows = count
  let bestCellSize = -1

  candidateCols.forEach((cols) => {
    const rows = Math.ceil(count / cols)
    const cellWidth = (innerWidth - (cols - 1) * gap) / cols
    const cellHeight = (innerHeight - (rows - 1) * gap) / rows
    const cellSize = Math.min(cellWidth, cellHeight)

    if (cellWidth > 0 && cellHeight > 0 && cellSize > bestCellSize) {
      bestCols = cols
      bestRows = rows
      bestCellSize = cellSize
    }
  })

  const cellWidth = (innerWidth - (bestCols - 1) * gap) / bestCols
  const cellHeight = (innerHeight - (bestRows - 1) * gap) / bestRows
  if (cellWidth <= 0 || cellHeight <= 0) return []

  return orderedContainers.map((type, idx) => {
    const row = Math.floor(idx / bestCols)
    const col = idx % bestCols
    return {
      x: x + padding + col * (cellWidth + gap),
      y: y + padding + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
      type,
    }
  })
}

function formatCount(count: number): string {
  return `${Math.round(count)}`
}

export default function PortCargoByMainlineView({
  width = DEFAULT_VIEW_SIZE.width,
  height = DEFAULT_VIEW_SIZE.height,
  csvFiles,
  onBarClick,
}: PortCargoByMainlineViewProps) {
  const dispatch = useAppDispatch()
  const portColorMap = useAppSelector((state) => state.colorMapping.portColors)
  const { tokens: { chart } } = useTheme()
  const { data, loading, error } = usePortCargoByMainlineData(csvFiles)

  useEffect(() => {
    const portIds = new Set<string>()
    data.forEach((row) => {
      portIds.add(row.port)
      row.groups.forEach((group) => {
        portIds.add(group.route)
      })
    })
    if (portIds.size > 0) {
      dispatch(registerPortIds(Array.from(portIds)))
    }
  }, [data, dispatch])

  const layout = useMemo(() => {
    const maxCount = Math.max(
      1,
      ...data.flatMap((p) => p.groups.map((g) => g.count))
    )

    return { maxCount }
  }, [data])

  if (loading) {
    return <div className={styles.state}>加载中...</div>
  }

  if (error) {
    return <div className={styles.stateError}>加载失败：{error}</div>
  }

  if (data.length === 0) {
    return <div className={styles.state}>暂无数据</div>
  }

  const chartHeight = Math.max(1, height - VIEW_MARGIN.top - VIEW_MARGIN.bottom)
  const chartWidth = width - VIEW_MARGIN.left - VIEW_MARGIN.right
  const computedRowHeight = chartHeight / Math.max(1, data.length)

  const widthScaleFactor = data.reduce((acc, row) => {
    if (row.totalCount <= 0) return acc
    const available = Math.max(0, chartWidth - Math.max(0, row.groups.length - 1) * BLOCK_GAP)
    const candidate = available / row.totalCount
    return Math.min(acc, candidate)
  }, Number.POSITIVE_INFINITY)

  const countToWidth = d3
    .scaleLinear()
    .domain([0, layout.maxCount])
    .range([0, layout.maxCount * (Number.isFinite(widthScaleFactor) ? widthScaleFactor : 0)])

  const yScale = d3
    .scaleBand<string>()
    .domain(data.map((d) => d.port))
    .range([0, chartHeight])
    .paddingInner(ROW_BAND_PADDING_INNER)

  const bandHeight = yScale.bandwidth()
  const preferredRowInnerHeight = Math.max(MIN_ROW_INNER_HEIGHT, computedRowHeight - ROW_INNER_HEIGHT_SHRINK)
  const rowInnerHeight = Math.max(
    ROW_INNER_HEIGHT_FLOOR,
    Math.min(preferredRowInnerHeight, Math.max(ROW_INNER_HEIGHT_FLOOR, bandHeight - ROW_INNER_SAFE_GAP))
  )

  return (
    <div className={styles.container}>
      <svg width={width} height={height}>
        <g transform={`translate(${VIEW_MARGIN.left},${VIEW_MARGIN.top})`}>
          {data.map((portRow, rowIndex) => {
            const rowY = yScale(portRow.port) ?? rowIndex * computedRowHeight
            const rowBaseY = rowY + Math.max(0, (bandHeight - rowInnerHeight) / 2)
            const widths = portRow.groups.map((group) => Math.max(0, countToWidth(group.count)))
            let cursorX = 0

            return (
              <g key={portRow.port}>
                <text
                  x={PORT_LABEL_OFFSET.x}
                  y={rowY + bandHeight / 2 + PORT_LABEL_OFFSET.y}
                  className={styles.portLabel}
                  textAnchor="end"
                >
                  {portRow.port}
                </text>

                <rect
                  x={0}
                  y={rowY}
                  width={chartWidth}
                  height={bandHeight}
                  fill={chart.rowBgFill}
                  opacity={ROW_DECORATION_STYLE.backgroundOpacity}
                  stroke="none"
                />

                <line
                  x1={0}
                  x2={chartWidth}
                  y1={rowY + bandHeight}
                  y2={rowY + bandHeight}
                  stroke={chart.rowDividerColor}
                  strokeDasharray={ROW_DECORATION_STYLE.dividerDashArray}
                  opacity={ROW_DECORATION_STYLE.dividerOpacity}
                />

                {portRow.groups.map((block, blockIndex) => {
                  const gx = cursorX
                  const blockWidth = widths[blockIndex] ?? 0
                  cursorX += blockWidth + BLOCK_GAP

                  const blockHeight = rowInnerHeight
                  const blockY = rowBaseY + (rowInnerHeight - blockHeight) / 2
                  const cells = buildContainerCells(block.containers, gx, blockY, blockWidth, blockHeight)

                  const color = resolvePortColor(block.route, portColorMap)
                  const borderColor = d3.color(color)?.darker(0.6).formatHex() ?? '#374151'

                  return (
                    <g key={`${portRow.port}-${block.route}-${blockIndex}`}>
                      <rect
                        x={gx}
                        y={blockY}
                        width={blockWidth}
                        height={blockHeight}
                        fill={chart.blockBg}
                        opacity={1}
                        stroke={borderColor}
                        strokeWidth={BLOCK_STYLE.blockStrokeWidth}
                        style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                        onClick={() => onBarClick?.(portRow.port, block.route)}
                      />

                      {cells.map((cell, idx) => (
                        <rect
                          key={`${portRow.port}-${block.route}-${blockIndex}-cell-${idx}`}
                          x={cell.x}
                          y={cell.y}
                          width={cell.width}
                          height={cell.height}
                          fill={cell.type === 'empty' ? chart.emptyCellFill : color}
                          stroke={borderColor}
                          strokeWidth={BLOCK_STYLE.cellStrokeWidth}
                          opacity={
                            cell.type === 'empty'
                              ? BLOCK_STYLE.emptyCellOpacity
                              : BLOCK_STYLE.heavyCellOpacity
                          }
                          pointerEvents="none"
                        />
                      ))}

                      {blockWidth >= COUNT_LABEL_MIN_BLOCK_WIDTH && blockHeight >= COUNT_LABEL_MIN_BLOCK_HEIGHT && (
                        <text
                          x={gx + blockWidth / 2}
                          y={blockY + blockHeight / 2 + 4}
                          className={styles.teuLabel}
                          textAnchor="middle"
                        >
                          {formatCount(block.count)}
                        </text>
                      )}

                    </g>
                  )
                })}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
