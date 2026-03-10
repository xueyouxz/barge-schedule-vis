import { useEffect, useMemo, useRef, useState } from 'react'
import {
  arc,
  color,
  max,
  min,
  select,
  type BaseType,
  type DefaultArcObject,
  type Selection
} from 'd3'
import { ViewStateOverlay } from '@/shared/components/ViewStateOverlay/ViewStateOverlay'
import { fmtDayLabel, fmtHours } from '@/shared/lib/formatUtils'
import { buildPortColorMap } from '@/shared/lib/portColors'
import { useContainerSize } from '@/shared/lib/useContainerSize'
import { useTheme } from '@/shared/theme'
import type { ThemeTokens } from '@/shared/theme/theme.types'
import { BARGE_CARGO_GANTT_CONFIG } from './config'
import { CargoDetailPopup, GanttTooltip } from './GanttTooltip'
import { useBargeCargoGanttData } from './hooks/useBargeCargoGanttData'
import styles from './BargeCargoGanttView.module.css'
import type {
  BargeCargoGanttViewProps,
  GanttDataset,
  GanttEvent,
  InteractiveEvent,
  PortSummaryEvent,
  ShipRow
} from './types'

const HEAD_H = BARGE_CARGO_GANTT_CONFIG.layout.headerHeight
const BLOCK_H = BARGE_CARGO_GANTT_CONFIG.layout.blockHeight
const MIN_BLOCK_H = BARGE_CARGO_GANTT_CONFIG.layout.minBlockHeight
const MIN_BLOCK_W = BARGE_CARGO_GANTT_CONFIG.layout.minBlockWidth
const PORT_BAND_Y_INSET = BARGE_CARGO_GANTT_CONFIG.portBand.yInset
const PORT_BAND_ACTIVE_OPACITY = BARGE_CARGO_GANTT_CONFIG.portBand.activeOpacity
const PORT_BAND_STROKE_WIDTH = BARGE_CARGO_GANTT_CONFIG.portBand.strokeWidth

type AnySelection = Selection<BaseType, unknown, null, undefined>
type SvgSelection = Selection<SVGSVGElement, unknown, null, undefined>
type GroupSelection = Selection<SVGGElement, unknown, null, undefined>
type TooltipState = {
  event: InteractiveEvent
  x: number
  y: number
} | null
type PopupState = {
  event: InteractiveEvent
  x: number
  y: number
} | null

type BlockPosition = {
  xMid: number
  yTop: number
  yBottom: number
  rowTop: number
  rowBottom: number
}

interface LayoutParams {
  width: number
  height: number
  rowAreaTopY: number
  pxPerHour: number
  rowH: number
  sailY: number
  loadAmountLabelY: number
  unloadAmountLabelY: number
  maxBlockH: number
  minBlockH: number
  donutOuterRadius: number
  donutInnerRadius: number
  stowInnerOffset: number
  stowOuterOffset: number
}

interface ChartPalette {
  chart: ThemeTokens['chart']
  cLoad: string
  cUnload: string
  cTrans: string
  cSail: string
  cCargoBig: string
  cCargoNormal: string
  cCargoDanger: string
  portBandFallback: string
}

interface RenderCallbacks {
  showTip: (mouseEvent: MouseEvent, event: InteractiveEvent) => void
  hideTip: () => void
  openCargoDetail: (event: InteractiveEvent, x: number, y: number) => void
  onBarClick?: (event: InteractiveEvent) => void
}

function buildShipPortStaySegments(
  events: GanttEvent[]
): Array<{ port: string; startHour: number; endHour: number }> {
  const stayEvents = events
    .filter(event => event.type !== 'sailing')
    .slice()
    .sort((left, right) => left.startHour - right.startHour)

  if (!stayEvents.length) return []

  const segments: Array<{ port: string; startHour: number; endHour: number }> = []
  const epsilon = 1e-6

  stayEvents.forEach(event => {
    const last = segments[segments.length - 1]
    if (last && last.port === event.port && event.startHour <= last.endHour + epsilon) {
      last.endHour = Math.max(last.endHour, event.endHour)
      return
    }

    segments.push({
      port: event.port,
      startHour: event.startHour,
      endHour: event.endHour
    })
  })

  return segments
}

function createLayout(width: number, height: number | undefined, data: GanttDataset): LayoutParams {
  const computedWidth = Math.max(width, 1)
  const rowAreaTopY = HEAD_H
  const fallbackHeight = rowAreaTopY + data.ships.length * BARGE_CARGO_GANTT_CONFIG.layout.rowHeight
  const computedHeight = height ? Math.max(height, HEAD_H + 1) : fallbackHeight
  const timelineW = computedWidth
  const pxPerHour = timelineW / Math.max(data.endHour, 1)
  const plotH = Math.max(1, computedHeight - rowAreaTopY)
  const rowH = plotH / Math.max(data.ships.length, 1)
  const sailY = rowH / 2
  const loadAmountLabelY = sailY + 4
  const unloadAmountLabelY = sailY - 4
  const maxBlockH = Math.min(rowH * BARGE_CARGO_GANTT_CONFIG.layout.maxBlockHeightRatio, rowH / 2)
  const minBlockH = Math.max(1, Math.min(MIN_BLOCK_H, maxBlockH))
  const donutOuterRadius = Math.min(
    BARGE_CARGO_GANTT_CONFIG.donut.maxOuterRadius,
    Math.max(
      BARGE_CARGO_GANTT_CONFIG.donut.minOuterRadius,
      rowH * BARGE_CARGO_GANTT_CONFIG.donut.outerRadiusRowHeightRatio
    )
  )
  const donutInnerRadius = donutOuterRadius * 0.8

  return {
    width: computedWidth,
    height: computedHeight,
    rowAreaTopY,
    pxPerHour,
    rowH,
    sailY,
    loadAmountLabelY,
    unloadAmountLabelY,
    maxBlockH,
    minBlockH,
    donutOuterRadius,
    donutInnerRadius,
    stowInnerOffset: Math.max(1, donutOuterRadius * 0.18),
    stowOuterOffset: Math.max(0.5, donutOuterRadius * 0.08)
  }
}

function mixColors(colorA: string, colorB: string, ratio: number) {
  const left = color(colorA)
  const right = color(colorB)

  if (!left && !right) return '#000000'
  if (!left) return right?.formatRgb() ?? '#000000'
  if (!right) return left.formatRgb()

  const clampedRatio = Math.max(0, Math.min(1, ratio))
  const inverse = 1 - clampedRatio

  return `rgb(${Math.round(left.r * inverse + right.r * clampedRatio)} ${Math.round(
    left.g * inverse + right.g * clampedRatio
  )} ${Math.round(left.b * inverse + right.b * clampedRatio)})`
}

function applyAlpha(input: string, alpha: number) {
  const parsed = color(input)
  if (!parsed) return input
  parsed.opacity = Math.max(0, Math.min(1, alpha))
  return parsed.formatRgb()
}

function getPortBandPaint(
  baseColor: string,
  rowIndex: number,
  palette: ChartPalette
): { fill: string; stroke: string } {
  const rowBackground =
    rowIndex % 2 === 0 ? palette.chart.rowBackgroundEven : palette.chart.rowBackgroundOdd
  const softened = mixColors(baseColor, palette.chart.surface, 0.62)
  const fill = mixColors(softened, rowBackground, 0.5)
  const stroke = mixColors(baseColor, palette.chart.border, 0.35)

  return {
    fill: applyAlpha(fill, 0.92),
    stroke: applyAlpha(stroke, 0.78)
  }
}

function renderDefs(defs: AnySelection, palette: ChartPalette) {
  const gLoad = defs
    .append('linearGradient')
    .attr('id', 'bcgv-load')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%')

  gLoad
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', palette.chart.loadGradientTop)
    .attr('stop-opacity', 0.95)
  gLoad
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', palette.chart.loadGradientBottom)
    .attr('stop-opacity', 0.85)

  const gUnload = defs
    .append('linearGradient')
    .attr('id', 'bcgv-unload')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%')

  gUnload
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', palette.chart.unloadGradientTop)
    .attr('stop-opacity', 0.95)
  gUnload
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', palette.chart.unloadGradientBottom)
    .attr('stop-opacity', 0.85)

  defs
    .append('marker')
    .attr('id', 'bcgv-transship-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8)
    .attr('refY', 5)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', palette.cTrans)
    .attr('opacity', 0.88)
}

function renderTimeAxis(
  axisG: GroupSelection,
  data: GanttDataset,
  layout: LayoutParams,
  chart: ThemeTokens['chart']
) {
  const dayHours = BARGE_CARGO_GANTT_CONFIG.axis.dayEveryHours
  const axisBandHeight = HEAD_H

  for (let dayStart = 0; dayStart < data.endHour; dayStart += dayHours) {
    const dayWidthHours = Math.min(dayHours, data.endHour - dayStart)
    const x = dayStart * layout.pxPerHour
    const width = dayWidthHours * layout.pxPerHour
    const dayDate = new Date(data.startTime.getTime() + dayStart * 60 * 60 * 1000)

    axisG
      .append('rect')
      .attr('x', x)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', axisBandHeight)
      .attr('fill', (dayStart / dayHours) % 2 === 0 ? chart.dayBandEven : chart.dayBandOdd)
      .attr('stroke', chart.gridLineColor)
      .attr('stroke-width', BARGE_CARGO_GANTT_CONFIG.axis.borderWidth)

    axisG
      .append('text')
      .attr('x', x + BARGE_CARGO_GANTT_CONFIG.axis.dayLabelOffsetX)
      .attr('y', axisBandHeight / 2)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'start')
      .attr('font-size', BARGE_CARGO_GANTT_CONFIG.axis.dayLabelFontSize)
      .attr('fill', chart.axisLabelColor)
      .text(fmtDayLabel(dayDate))
  }
}

function renderEtdMarks(
  axisG: GroupSelection,
  data: GanttDataset,
  layout: LayoutParams,
  stroke: string
) {
  data.etdMarks.forEach(mark => {
    const x = mark.hour * layout.pxPerHour

    axisG
      .append('line')
      .attr('x1', x)
      .attr('y1', HEAD_H)
      .attr('x2', x)
      .attr('y2', layout.height)
      .attr('stroke', stroke)
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', BARGE_CARGO_GANTT_CONFIG.drawing.etdDashArray)
      .attr('opacity', 0.45)

    axisG
      .append('text')
      .attr('x', x + 4)
      .attr('y', HEAD_H - 6)
      .attr('fill', stroke)
      .attr('font-size', 8)
      .attr('opacity', 0.6)
      .text(mark.label)
  })
}

function createPortSummaryEvent(
  ship: ShipRow,
  segment: { port: string; startHour: number; endHour: number },
  data: GanttDataset
): PortSummaryEvent {
  const portCargoEvents = ship.events.filter(
    event =>
      event.port === segment.port &&
      (event.type === 'loading' || event.type === 'unloading') &&
      event.startHour >= segment.startHour - 1e-6 &&
      event.endHour <= segment.endHour + 1e-6
  )
  const groupMap = new Map<string, { teu: number; count: number; sampleContainers: string[] }>()

  portCargoEvents.forEach(event => {
    event.cargoDetail?.groups.forEach(group => {
      const existing = groupMap.get(group.mainlinePort)
      if (existing) {
        existing.teu += group.teu
        existing.count += group.count
        return
      }

      groupMap.set(group.mainlinePort, {
        teu: group.teu,
        count: group.count,
        sampleContainers: [...group.sampleContainers]
      })
    })
  })

  const groups = Array.from(groupMap.entries()).map(([mainlinePort, detail]) => ({
    mainlinePort,
    teu: detail.teu,
    count: detail.count,
    sampleContainers: detail.sampleContainers
  }))

  return {
    id: `port-bg-${ship.id}-${segment.port}-${segment.startHour}`,
    shipId: ship.id,
    vessel: ship.vessel,
    voyage: ship.voyage,
    port: segment.port,
    type: 'port-summary',
    startTime: new Date(data.startTime.getTime() + segment.startHour * 3600000),
    endTime: new Date(data.startTime.getTime() + segment.endHour * 3600000),
    startHour: segment.startHour,
    endHour: segment.endHour,
    cargoDetail:
      groups.length > 0
        ? {
            totalTeu: groups.reduce((sum, group) => sum + group.teu, 0),
            totalCount: groups.reduce((sum, group) => sum + group.count, 0),
            groups
          }
        : undefined
  }
}

function renderShipRow(
  svg: SvgSelection,
  ship: ShipRow,
  rowIndex: number,
  data: GanttDataset,
  layout: LayoutParams,
  portColorMap: Map<string, string>,
  palette: ChartPalette,
  callbacks: RenderCallbacks
): Record<string, BlockPosition> {
  const rowY = layout.rowAreaTopY + rowIndex * layout.rowH
  const rowG = svg.append('g').attr('transform', `translate(0, ${rowY})`)
  const areaG = rowG.append('g')
  const blockPositions: Record<string, BlockPosition> = {}

  // --- 港口驻留背景带 ---
  const portBandG = areaG.append('g')
  buildShipPortStaySegments(ship.events).forEach(segment => {
    const x = segment.startHour * layout.pxPerHour
    const bandWidth = Math.max(1, (segment.endHour - segment.startHour) * layout.pxPerHour)
    const baseColor = portColorMap.get(segment.port) ?? palette.portBandFallback
    const { fill, stroke } = getPortBandPaint(baseColor, rowIndex, palette)
    const summaryEvent = createPortSummaryEvent(ship, segment, data)

    portBandG
      .append('rect')
      .attr('x', x)
      .attr('y', PORT_BAND_Y_INSET)
      .attr('width', bandWidth)
      .attr('height', Math.max(1, layout.rowH - PORT_BAND_Y_INSET * 2))
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', PORT_BAND_STROKE_WIDTH)
      .attr('stroke-opacity', 0.35)
      .attr('opacity', PORT_BAND_ACTIVE_OPACITY)
      .style('cursor', 'pointer')
      .on('mousemove', (mouseEvent: MouseEvent) => callbacks.showTip(mouseEvent, summaryEvent))
      .on('mouseleave', callbacks.hideTip)
      .on('click', (mouseEvent: MouseEvent) => {
        mouseEvent.stopPropagation()
        callbacks.hideTip()
        callbacks.openCargoDetail(summaryEvent, x + bandWidth / 2, rowY + layout.rowH / 2)
        callbacks.onBarClick?.(summaryEvent)
      })
  })

  rowG
    .append('line')
    .attr('x1', 0)
    .attr('y1', layout.rowH)
    .attr('x2', layout.width)
    .attr('y2', layout.rowH)
    .attr('stroke', palette.chart.border)
    .attr('stroke-width', 0.5)

  const minStart = min(ship.events, event => event.startHour) ?? 0
  const maxEnd = max(ship.events, event => event.endHour) ?? minStart

  areaG
    .append('line')
    .attr('x1', minStart * layout.pxPerHour)
    .attr('y1', layout.sailY)
    .attr('x2', maxEnd * layout.pxPerHour)
    .attr('y2', layout.sailY)
    .attr('stroke', palette.cSail)
    .attr('stroke-width', 1)
    .attr('opacity', 0.25)

  const drawNonCargoSegment = (event: GanttEvent, opacity: number) => {
    areaG
      .append('line')
      .attr('x1', event.startHour * layout.pxPerHour)
      .attr('y1', layout.sailY)
      .attr('x2', event.endHour * layout.pxPerHour)
      .attr('y2', layout.sailY)
      .attr('stroke', palette.cSail)
      .attr('stroke-width', BARGE_CARGO_GANTT_CONFIG.drawing.nonCargoLineWidth)
      .attr('stroke-linecap', 'round')
      .attr('opacity', opacity)
      .on('mousemove', (mouseEvent: MouseEvent) => callbacks.showTip(mouseEvent, event))
      .on('mouseleave', callbacks.hideTip)
  }

  // --- 航行段 + 圆环 ---
  ship.events
    .filter(event => event.type === 'sailing')
    .forEach(event => {
      const x1 = event.startHour * layout.pxPerHour
      const x2 = event.endHour * layout.pxPerHour
      const segmentWidth = x2 - x1

      drawNonCargoSegment(event, 0.55)

      if (
        !event.cargo ||
        !event.maxTeu ||
        segmentWidth <
          layout.donutOuterRadius * BARGE_CARGO_GANTT_CONFIG.donut.minSegmentWidthFactor
      ) {
        return
      }

      const midX = (x1 + x2) / 2
      const total = event.cargo.big + event.cargo.normal + event.cargo.danger
      const onboardTeu = event.teu ?? event.cargo.onboard
      const stowRate = Math.max(0, Math.min(1, onboardTeu / event.maxTeu))
      const donutG = areaG.append('g').attr('transform', `translate(${midX}, ${layout.sailY})`)

      donutG
        .append('circle')
        .attr('r', layout.donutOuterRadius + 1)
        .attr(
          'fill',
          rowIndex % 2 === 0 ? palette.chart.rowBackgroundEven : palette.chart.rowBackgroundOdd
        )

      if (total > 0) {
        const segments = [
          { val: event.cargo.big, color: palette.cCargoBig },
          { val: event.cargo.normal, color: palette.cCargoNormal },
          { val: event.cargo.danger, color: palette.cCargoDanger }
        ].filter(segment => segment.val > 0)

        let angle = -Math.PI / 2
        const gap = total > 1 ? BARGE_CARGO_GANTT_CONFIG.donut.segmentGap : 0

        segments.forEach(segment => {
          const sweep = (segment.val / total) * Math.PI * 2 - gap
          const arcPath = arc<DefaultArcObject>().cornerRadius(
            BARGE_CARGO_GANTT_CONFIG.donut.cornerRadius
          )({
            innerRadius: layout.donutInnerRadius,
            outerRadius: layout.donutOuterRadius,
            startAngle: angle + gap / 2,
            endAngle: angle + gap / 2 + sweep,
            padAngle: 0
          })

          donutG
            .append('path')
            .attr('d', arcPath ?? '')
            .attr('fill', segment.color)
            .attr('opacity', 0.78)
          angle += sweep + gap
        })
      }

      const stowArc = arc<DefaultArcObject>()({
        innerRadius: layout.donutInnerRadius - layout.stowInnerOffset,
        outerRadius: layout.donutInnerRadius - layout.stowOuterOffset,
        startAngle: -Math.PI / 2,
        endAngle: -Math.PI / 2 + stowRate * Math.PI * 2,
        padAngle: 0
      })

      donutG
        .append('path')
        .attr('d', stowArc ?? '')
        .attr('fill', palette.cSail)
        .attr('opacity', 0.42)
      donutG
        .append('circle')
        .attr('r', layout.donutInnerRadius - 1)
        .attr(
          'fill',
          rowIndex % 2 === 0 ? palette.chart.rowBackgroundEven : palette.chart.rowBackgroundOdd
        )

      donutG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('x', 0)
        .attr('y', 0)
        .attr('fill', palette.chart.text)
        .attr('font-weight', 600)
        .call(text => {
          const valueFontSize = Math.max(9, Math.min(15, layout.donutOuterRadius * 0.66))
          const percentFontSize = Math.max(6, Math.min(10, layout.donutOuterRadius * 0.38))

          text
            .append('tspan')
            .attr('font-size', valueFontSize)
            .text(`${Math.round(stowRate * 100)}`)

          text.append('tspan').attr('font-size', percentFontSize).attr('dx', 0.5).text('%')
        })
    })

  ship.events
    .filter(event => event.type === 'waiting' || event.type === 'wrapup')
    .forEach(event => {
      drawNonCargoSegment(event, 0.5)
    })

  // --- 装卸块 ---
  ship.events
    .filter(event => event.type === 'loading' || event.type === 'unloading')
    .forEach(event => {
      const x = event.startHour * layout.pxPerHour
      const blockWidth = Math.max((event.endHour - event.startHour) * layout.pxPerHour, MIN_BLOCK_W)
      const isLoading = event.type === 'loading'
      const fallbackBlockH = Math.max(layout.minBlockH, Math.min(BLOCK_H, layout.maxBlockH))
      const scaledBlockH =
        ship.maxTeu > 0 && typeof event.teu === 'number'
          ? (event.teu / ship.maxTeu) * layout.maxBlockH
          : layout.minBlockH
      const blockHeight =
        typeof event.teu === 'number' && event.teu >= 0
          ? Math.max(layout.minBlockH, Math.min(layout.maxBlockH, scaledBlockH))
          : fallbackBlockH
      const blockY = isLoading ? layout.sailY - blockHeight : layout.sailY
      const stroke = isLoading ? palette.cLoad : palette.cUnload
      const gradient = isLoading ? 'url(#bcgv-load)' : 'url(#bcgv-unload)'

      areaG
        .append('rect')
        .attr('x', x + 1)
        .attr('y', blockY + 1)
        .attr('width', blockWidth)
        .attr('height', blockHeight)
        .attr('fill', stroke)
        .attr('opacity', 0.06)

      areaG
        .append('rect')
        .attr('x', x)
        .attr('y', blockY)
        .attr('width', blockWidth)
        .attr('height', blockHeight)
        .attr('fill', gradient)
        .attr('stroke', stroke)
        .attr('stroke-width', 1.1)
        .attr('stroke-opacity', 0.9)
        .attr('opacity', 1)
        .on('mousemove', (mouseEvent: MouseEvent) => callbacks.showTip(mouseEvent, event))
        .on('mouseleave', callbacks.hideTip)
        .on('click', (mouseEvent: MouseEvent) => {
          mouseEvent.stopPropagation()
          callbacks.hideTip()
          callbacks.onBarClick?.(event)
        })

      if (typeof event.teu === 'number') {
        areaG
          .append('text')
          .attr('x', x + blockWidth / 2)
          .attr('y', isLoading ? layout.loadAmountLabelY : layout.unloadAmountLabelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', isLoading ? 'hanging' : 'auto')
          .attr('font-size', 10)
          .attr('font-weight', 600)
          .attr('fill', stroke)
          .attr('opacity', 0.9)
          .text(`${event.teu}`)
      }

      blockPositions[event.id] = {
        xMid: x + blockWidth / 2,
        yTop: rowY + blockY,
        yBottom: rowY + blockY + blockHeight,
        rowTop: rowY,
        rowBottom: rowY + layout.rowH
      }
    })

  return blockPositions
}

function renderTransshipConnections(
  svg: SvgSelection,
  data: GanttDataset,
  blockPositions: Record<string, BlockPosition>,
  palette: ChartPalette
) {
  const eventById = new Map(data.events.map(event => [event.id, event]))

  data.transshipConnections.forEach(connection => {
    const from = blockPositions[connection.fromEventId]
    const to = blockPositions[connection.toEventId]
    if (!from || !to) return

    const fromEvent = eventById.get(connection.fromEventId)
    const toEvent = eventById.get(connection.toEventId)
    const x1 = from.xMid
    let y1 = from.yBottom
    const x2 = to.xMid
    let y2 = to.yTop

    if (from.yTop > to.yTop) {
      y1 = from.yTop
      y2 = to.yBottom
    }

    const startRowBoundaryY = y2 >= y1 ? from.rowBottom : from.rowTop
    const polylinePoints = [
      `${x1},${y1}`,
      `${x1},${startRowBoundaryY}`,
      `${x2},${startRowBoundaryY}`,
      `${x2},${y2}`
    ].join(' ')
    const transferHours =
      fromEvent && toEvent
        ? Math.max(0, (toEvent.endTime.getTime() - fromEvent.endTime.getTime()) / (60 * 60 * 1000))
        : 0

    const connectionG = svg.append('g')

    connectionG
      .append('polyline')
      .attr('points', polylinePoints)
      .attr('fill', 'none')
      .attr('stroke', palette.cTrans)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', BARGE_CARGO_GANTT_CONFIG.drawing.transshipDashArray)
      .attr('marker-end', 'url(#bcgv-transship-arrow)')
      .attr('opacity', 0.68)

    connectionG
      .append('text')
      .attr('x', (x1 + x2) / 2)
      .attr('y', startRowBoundaryY - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', palette.cTrans)
      .attr('opacity', 1)
      .text(`${connection.teu} TEU · ${fmtHours(transferHours)}h`)
  })
}

export default function BargeCargoGanttView({
  infoPath,
  recordsPath,
  containerRecordsPath,
  onBarClick
}: BargeCargoGanttViewProps) {
  const [containerRef, containerSize] = useContainerSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const onBarClickRef = useRef(onBarClick)
  const {
    theme,
    tokens: { chart }
  } = useTheme()
  const [tooltipState, setTooltipState] = useState<TooltipState>(null)
  const [popupState, setPopupState] = useState<PopupState>(null)

  useEffect(() => {
    onBarClickRef.current = onBarClick
  }, [onBarClick])

  const { data, loading, error } = useBargeCargoGanttData(
    infoPath,
    recordsPath,
    containerRecordsPath
  )

  const portColorMap = useMemo(() => {
    if (!data) {
      return new Map<string, string>()
    }

    const portSet = new Set<string>()
    data.events.forEach(event => {
      if (event.type !== 'sailing' && event.port) {
        portSet.add(event.port)
      }

      event.cargoDetail?.groups.forEach(group => {
        if (group.mainlinePort) {
          portSet.add(group.mainlinePort)
        }
      })
    })

    return buildPortColorMap(portSet, theme)
  }, [data, theme])

  const layout = useMemo(() => {
    if (!data) return null
    return createLayout(
      containerSize.width,
      containerSize.height > 0 ? containerSize.height : undefined,
      data
    )
  }, [containerSize.height, containerSize.width, data])

  const palette = useMemo<ChartPalette>(
    () => ({
      chart,
      cLoad: chart.load,
      cUnload: chart.unload,
      cTrans: chart.transship,
      cSail: chart.sail,
      cCargoBig: chart.cargoBig,
      cCargoNormal: chart.cargoNormal,
      cCargoDanger: chart.cargoDanger,
      portBandFallback: chart.portBandFallback
    }),
    [chart]
  )

  useEffect(() => {
    if (!svgRef.current || !data || !layout) return

    setTooltipState(null)
    setPopupState(null)

    const svg = select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', layout.width).attr('height', layout.height)

    renderDefs(svg.append('defs'), palette)

    const axisG = svg.append('g')
    renderTimeAxis(axisG, data, layout, chart)
    renderEtdMarks(axisG, data, layout, palette.cUnload)

    const showTip = (mouseEvent: MouseEvent, event: InteractiveEvent) => {
      setTooltipState({
        event,
        x: Math.min(mouseEvent.clientX + 14, window.innerWidth - 320),
        y: mouseEvent.clientY - 12
      })
    }

    const hideTip = () => {
      setTooltipState(null)
    }

    const openCargoDetail = (event: InteractiveEvent, x: number, y: number) => {
      const popupWidth = 280
      const popupHeight = 200
      const margin = 8
      const xCandidate = x + margin
      const finalX =
        xCandidate + popupWidth > layout.width - margin
          ? Math.max(margin, x - popupWidth - margin)
          : Math.max(margin, xCandidate)
      const finalY = Math.max(margin, Math.min(y, layout.height - popupHeight - margin))

      setPopupState({ event, x: finalX, y: finalY })
    }

    const callbacks: RenderCallbacks = {
      showTip,
      hideTip,
      openCargoDetail,
      onBarClick: event => onBarClickRef.current?.(event)
    }

    const blockPositions = data.ships.reduce<Record<string, BlockPosition>>(
      (accumulator, ship, rowIndex) => {
        Object.assign(
          accumulator,
          renderShipRow(svg, ship, rowIndex, data, layout, portColorMap, palette, callbacks)
        )
        return accumulator
      },
      {}
    )

    renderTransshipConnections(svg, data, blockPositions, palette)

    svg.on('click', () => {
      setPopupState(null)
      hideTip()
    })
  }, [chart, data, layout, palette, portColorMap])

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{
        minHeight: layout?.height
      }}
    >
      <ViewStateOverlay
        loading={loading}
        error={error ? `甘特图数据加载失败：${error}` : null}
        loadingText='正在加载仿真数据...'
      />

      <div
        className={styles.wrap}
        style={{ width: layout?.width, height: layout?.height }}
        onClick={() => setPopupState(null)}
      >
        <svg ref={svgRef} />
        <CargoDetailPopup
          event={popupState?.event ?? null}
          position={{ x: popupState?.x ?? 0, y: popupState?.y ?? 0 }}
          portColorMap={portColorMap}
          theme={theme}
          onClose={() => setPopupState(null)}
        />
      </div>

      <GanttTooltip
        event={tooltipState?.event ?? null}
        position={{ x: tooltipState?.x ?? 0, y: tooltipState?.y ?? 0 }}
        visible={tooltipState !== null}
      />
    </div>
  )
}
