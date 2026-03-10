import { useMemo } from 'react'
import { color as d3Color, scaleBand, scaleLinear } from 'd3'
import { ViewStateOverlay } from '@/shared/components/ViewStateOverlay/ViewStateOverlay'
import { useTheme } from '@/shared/theme'
import { resolvePortColor } from '@/shared/lib/portColors'
import { usePortCargoByMainlineData } from './usePortCargoByMainlineData'
import type { ContainerLoadType, PortCargoByMainlineViewProps } from './types'
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
  VIEW_MARGIN
} from './config'
import styles from './PortCargoByMainlineView.module.css'

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
    ...containers.filter(type => type === 'heavy'),
    ...containers.filter(type => type === 'empty')
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
    ...columnSearchScales.map(scale => {
      const candidate = approxCols * scale
      return scale >= 1 ? Math.min(count, Math.ceil(candidate)) : Math.max(1, Math.floor(candidate))
    })
  ])

  let bestCols = 1
  let bestRows = count
  let bestCellSize = -1

  candidateCols.forEach(cols => {
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

  return orderedContainers.map((type, index) => {
    const row = Math.floor(index / bestCols)
    const column = index % bestCols

    return {
      x: x + padding + column * (cellWidth + gap),
      y: y + padding + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
      type
    }
  })
}

function formatCount(count: number): string {
  return `${Math.round(count)}`
}

function getRowBackground(rowIndex: number): string {
  return rowIndex % 2 === 0 ? 'var(--chart-row-background-even)' : 'var(--chart-row-background-odd)'
}

export default function PortCargoByMainlineView({
  width = DEFAULT_VIEW_SIZE.width,
  height = DEFAULT_VIEW_SIZE.height,
  csvFiles,
  selectedPort,
  onBarClick
}: PortCargoByMainlineViewProps) {
  const {
    theme,
    tokens: { chart }
  } = useTheme()
  const { data, loading, error } = usePortCargoByMainlineData(csvFiles)

  const layout = useMemo(() => {
    const maxCount = Math.max(1, ...data.flatMap(row => row.groups.map(group => group.count)))
    return { maxCount }
  }, [data])

  if (loading || error || data.length === 0) {
    return (
      <ViewStateOverlay
        loading={loading}
        error={error ? `加载失败：${error}` : null}
        empty={data.length === 0}
      />
    )
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

  const countToWidth = scaleLinear()
    .domain([0, layout.maxCount])
    .range([0, layout.maxCount * (Number.isFinite(widthScaleFactor) ? widthScaleFactor : 0)])

  const yScale = scaleBand<string>()
    .domain(data.map(row => row.port))
    .range([0, chartHeight])
    .paddingInner(ROW_BAND_PADDING_INNER)

  const bandHeight = yScale.bandwidth()
  const preferredRowInnerHeight = Math.max(
    MIN_ROW_INNER_HEIGHT,
    computedRowHeight - ROW_INNER_HEIGHT_SHRINK
  )
  const rowInnerHeight = Math.max(
    ROW_INNER_HEIGHT_FLOOR,
    Math.min(
      preferredRowInnerHeight,
      Math.max(ROW_INNER_HEIGHT_FLOOR, bandHeight - ROW_INNER_SAFE_GAP)
    )
  )

  const emptyCellFill = chart.sail
  const dividerStroke = chart.gridLineColor
  const blockBackground = chart.surface
  const selectedStroke = chart.load
  const selectedRowFill = chart.selectedRowFill

  return (
    <div className={styles.container}>
      <svg className={styles.svg} width={width} height={height}>
        <g transform={`translate(${VIEW_MARGIN.left},${VIEW_MARGIN.top})`}>
          {data.map((portRow, rowIndex) => {
            const isSelectedRow = selectedPort === portRow.port
            const rowY = yScale(portRow.port) ?? rowIndex * computedRowHeight
            const rowBaseY = rowY + Math.max(0, (bandHeight - rowInnerHeight) / 2)
            const widths = portRow.groups.map(group => Math.max(0, countToWidth(group.count)))
            let cursorX = 0

            return (
              <g key={portRow.port}>
                <text
                  x={PORT_LABEL_OFFSET.x}
                  y={rowY + bandHeight / 2 + PORT_LABEL_OFFSET.y}
                  className={styles.portLabel}
                  fill={isSelectedRow ? selectedStroke : undefined}
                  textAnchor='end'
                >
                  {portRow.port}
                </text>

                <rect
                  x={0}
                  y={rowY}
                  width={chartWidth}
                  height={bandHeight}
                  fill={isSelectedRow ? selectedRowFill : getRowBackground(rowIndex)}
                  opacity={ROW_DECORATION_STYLE.backgroundOpacity}
                  stroke={isSelectedRow ? selectedStroke : 'none'}
                  strokeWidth={isSelectedRow ? 1.2 : 0}
                  rx={0}
                />

                <line
                  x1={0}
                  x2={chartWidth}
                  y1={rowY + bandHeight}
                  y2={rowY + bandHeight}
                  stroke={isSelectedRow ? selectedStroke : dividerStroke}
                  strokeDasharray={ROW_DECORATION_STYLE.dividerDashArray}
                  opacity={ROW_DECORATION_STYLE.dividerOpacity}
                />

                {portRow.groups.map((block, blockIndex) => {
                  const blockX = cursorX
                  const blockWidth = widths[blockIndex] ?? 0
                  cursorX += blockWidth + BLOCK_GAP

                  const blockHeight = rowInnerHeight
                  const blockY = rowBaseY + (rowInnerHeight - blockHeight) / 2
                  const cells = buildContainerCells(
                    block.containers,
                    blockX,
                    blockY,
                    blockWidth,
                    blockHeight
                  )
                  const blockColor = resolvePortColor(block.route, theme)
                  const borderColor = d3Color(blockColor)?.darker(0.6).formatHex() ?? '#374151'

                  return (
                    <g key={`${portRow.port}-${block.route}-${blockIndex}`}>
                      <rect
                        x={blockX}
                        y={blockY}
                        width={blockWidth}
                        height={blockHeight}
                        fill={blockBackground}
                        stroke={borderColor}
                        strokeWidth={
                          isSelectedRow
                            ? BLOCK_STYLE.blockStrokeWidth + 0.6
                            : BLOCK_STYLE.blockStrokeWidth
                        }
                        style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                        onClick={() => onBarClick?.(portRow.port, block.route)}
                      />

                      {cells.map((cell, cellIndex) => (
                        <rect
                          key={`${portRow.port}-${block.route}-${blockIndex}-cell-${cellIndex}`}
                          x={cell.x}
                          y={cell.y}
                          width={cell.width}
                          height={cell.height}
                          fill={cell.type === 'empty' ? emptyCellFill : blockColor}
                          stroke={borderColor}
                          strokeWidth={BLOCK_STYLE.cellStrokeWidth}
                          opacity={
                            cell.type === 'empty'
                              ? BLOCK_STYLE.emptyCellOpacity
                              : BLOCK_STYLE.heavyCellOpacity
                          }
                          pointerEvents='none'
                        />
                      ))}

                      {blockWidth >= COUNT_LABEL_MIN_BLOCK_WIDTH &&
                        blockHeight >= COUNT_LABEL_MIN_BLOCK_HEIGHT && (
                          <text
                            x={blockX + blockWidth / 2}
                            y={blockY + blockHeight / 2 + 4}
                            className={styles.countLabel}
                            textAnchor='middle'
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
