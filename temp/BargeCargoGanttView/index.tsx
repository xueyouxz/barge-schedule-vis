import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import styles from './style/index.module.css';
import type { BargeCargoGanttViewProps, GanttEvent } from './types';
import { useBargeCargoGanttData } from './hooks/useBargeCargoGanttData';
import { BARGE_CARGO_GANTT_CONFIG } from './config';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { registerPortIds } from '@/store/colorMappingSlice';
import { resolvePortColor } from '@/constants/colorMapping';
import { useTheme } from '@/theme';

const LABEL_W = BARGE_CARGO_GANTT_CONFIG.layout.labelWidth;
const HEAD_H = BARGE_CARGO_GANTT_CONFIG.layout.headerHeight;
const PORT_PANEL_H = BARGE_CARGO_GANTT_CONFIG.layout.portPanelHeight;
const PORT_ROW_H = BARGE_CARGO_GANTT_CONFIG.layout.portRowHeight;
const PAD_B = BARGE_CARGO_GANTT_CONFIG.layout.paddingBottom;
const PAD_R = BARGE_CARGO_GANTT_CONFIG.layout.paddingRight;
const BLOCK_H = BARGE_CARGO_GANTT_CONFIG.layout.blockHeight;
const MIN_BLOCK_H = BARGE_CARGO_GANTT_CONFIG.layout.minBlockHeight;
const BLOCK_RADIUS = BARGE_CARGO_GANTT_CONFIG.layout.blockRadius;
const MIN_BLOCK_W = BARGE_CARGO_GANTT_CONFIG.layout.minBlockWidth;
const PORT_BAND_Y_INSET = BARGE_CARGO_GANTT_CONFIG.portBand.yInset;
const PORT_BAND_ACTIVE_OPACITY = BARGE_CARGO_GANTT_CONFIG.portBand.activeOpacity;
const PORT_BAND_INACTIVE_OPACITY = BARGE_CARGO_GANTT_CONFIG.portBand.inactiveOpacity;
const PORT_BAND_STROKE_WIDTH = BARGE_CARGO_GANTT_CONFIG.portBand.strokeWidth;
const PORT_BAND_FALLBACK = BARGE_CARGO_GANTT_CONFIG.portBand.fallbackColor;

const C_LOAD = BARGE_CARGO_GANTT_CONFIG.colors.load;
const C_UNLOAD = BARGE_CARGO_GANTT_CONFIG.colors.unload;
const C_TRANS = BARGE_CARGO_GANTT_CONFIG.colors.transship;
const C_SAIL = BARGE_CARGO_GANTT_CONFIG.colors.sail;
const C_CARGO_BIG = BARGE_CARGO_GANTT_CONFIG.colors.cargoBig;
const C_CARGO_NORMAL = BARGE_CARGO_GANTT_CONFIG.colors.cargoNormal;
const C_CARGO_DANGER = BARGE_CARGO_GANTT_CONFIG.colors.cargoDanger;

function fmtDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function fmtDayLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function fmtHours(hours: number): string {
  const safe = Math.max(0, hours);
  const rounded = Math.round(safe * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function buildShipPortStaySegments(events: GanttEvent[]): Array<{ port: string; startHour: number; endHour: number }> {
  const stayEvents = events
    .filter((ev) => ev.type !== 'sailing')
    .slice()
    .sort((a, b) => a.startHour - b.startHour);

  if (!stayEvents.length) return [];

  const segments: Array<{ port: string; startHour: number; endHour: number }> = [];
  const EPS = 1e-6;

  stayEvents.forEach((ev) => {
    const last = segments[segments.length - 1];
    if (last && last.port === ev.port && ev.startHour <= last.endHour + EPS) {
      last.endHour = Math.max(last.endHour, ev.endHour);
      return;
    }

    segments.push({
      port: ev.port,
      startHour: ev.startHour,
      endHour: ev.endHour,
    });
  });

  return segments;
}

export default function BargeCargoGanttView({
  width = 1300,
  height,
  infoPath,
  recordsPath,
  containerRecordsPath,
  highlightPort,
  onBarClick,
}: BargeCargoGanttViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onBarClickRef = useRef(onBarClick);
  const highlightPortRef = useRef(highlightPort);
  const highlightUpdaterRef = useRef<Array<(hp: string | undefined) => void>>([]);
  const dispatch = useAppDispatch();
  const portColorMap = useAppSelector((state) => state.colorMapping.portColors);
  const { tokens: { chart } } = useTheme();
  const [selectedEvent, setSelectedEvent] = useState<{
    event: GanttEvent;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    onBarClickRef.current = onBarClick;
  }, [onBarClick]);

  useEffect(() => {
    highlightPortRef.current = highlightPort;
  }, [highlightPort]);

  const { data, loading } = useBargeCargoGanttData(infoPath, recordsPath, containerRecordsPath);

  useEffect(() => {
    if (!data) return;
    const portSet = new Set<string>();
    data.events.forEach((ev) => {
      if (ev.type !== 'sailing' && ev.port) {
        portSet.add(ev.port);
      }
      ev.cargoDetail?.groups.forEach((group) => {
        if (group.mainlinePort) {
          portSet.add(group.mainlinePort);
        }
      });
    });
    if (portSet.size > 0) {
      dispatch(registerPortIds(Array.from(portSet)));
    }
  }, [data, dispatch]);

  const chartHeight = useMemo(() => {
    if (!height) return undefined;
    return Math.max(height, PORT_PANEL_H + HEAD_H + PAD_B + 1);
  }, [height]);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    setSelectedEvent(null);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    highlightUpdaterRef.current = [];

    // ── Pre-compute port color map ──────────────────────────────────────────
    const portColors = new Map<string, string>();
    data.events
      .filter((ev) => ev.type !== 'sailing' && !!ev.port)
      .forEach((ev) => {
        if (portColors.has(ev.port)) return;
        portColors.set(ev.port, resolvePortColor(ev.port, portColorMap));
      });

    // ── Pre-compute per-port cargo change series (port perspective) ─────────
    // unloading event: cargo ARRIVES at port  → +teu
    // loading  event: cargo LEAVES    port  → -teu
    const topSeriesRaw = d3.group(
      data.events.filter(
        (ev) => ev.port && typeof ev.teu === 'number' && (ev.type === 'loading' || ev.type === 'unloading'),
      ),
      (ev) => ev.port,
    );
    const topSeries = Array.from(topSeriesRaw.entries())
      .map(([port, events]) => {
        const sorted = events.slice().sort((a, b) => a.startHour - b.startHour);
        const points: Array<{ hour: number; portCargo: number }> = [];
        let cumulative = 0;
        sorted.forEach((ev) => {
          const teu = ev.teu ?? 0;
          // 卸货：货箱从驳船转移到港口，港口库存增加；装货：货箱离港，港口库存减少
          const delta = ev.type === 'unloading' ? teu : -teu;
          points.push({ hour: ev.startHour, portCargo: cumulative });
          cumulative += delta;
          points.push({ hour: ev.endHour, portCargo: cumulative });
        });
        return { port, points };
      })
      .filter((s) => s.points.length > 0);

    // ── Dynamic port panel height: one row per port ────────────────────────
    const dynamicPortPanelH = Math.max(PORT_PANEL_H, topSeries.length * PORT_ROW_H);

    const W = Math.max(width, LABEL_W + PAD_R + 1);
    const rowAreaTopY = dynamicPortPanelH + HEAD_H;
    const fallbackH = rowAreaTopY + data.ships.length * BARGE_CARGO_GANTT_CONFIG.layout.rowHeight + PAD_B;
    const H = chartHeight ?? fallbackH;

    const timelineW = Math.max(1, W - LABEL_W - PAD_R);
    const pxPerHour = timelineW / Math.max(data.endHour, 1);

    const plotH = Math.max(1, H - rowAreaTopY - PAD_B);
    const rowH = plotH / Math.max(data.ships.length, 1);
    const sailY = rowH / 2;
    const loadAmountLabelY = sailY + 4;
    const unloadAmountLabelY = sailY - 4;
    const maxBlockH = Math.min(rowH * BARGE_CARGO_GANTT_CONFIG.layout.maxBlockHeightRatio, rowH / 2);
    const minBlockH = Math.max(1, Math.min(MIN_BLOCK_H, maxBlockH));

    const donutOuterRadius = Math.min(
      BARGE_CARGO_GANTT_CONFIG.donut.maxOuterRadius,
      Math.max(
        BARGE_CARGO_GANTT_CONFIG.donut.minOuterRadius,
        rowH * BARGE_CARGO_GANTT_CONFIG.donut.outerRadiusRowHeightRatio,
      ),
    );
    const donutInnerRadius = donutOuterRadius * 0.8;
    const stowInnerOffset = Math.max(1, donutOuterRadius * 0.18);
    const stowOuterOffset = Math.max(0.5, donutOuterRadius * 0.08);

    svg.attr('width', W).attr('height', H);

    const defs = svg.append('defs');

    const gLoad = defs
      .append('linearGradient')
      .attr('id', 'bcgv-load')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gLoad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', BARGE_CARGO_GANTT_CONFIG.drawing.loadGradientTop)
      .attr('stop-opacity', 0.95);
    gLoad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', BARGE_CARGO_GANTT_CONFIG.drawing.loadGradientBottom)
      .attr('stop-opacity', 0.85);

    const gUnload = defs
      .append('linearGradient')
      .attr('id', 'bcgv-unload')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gUnload
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', BARGE_CARGO_GANTT_CONFIG.drawing.unloadGradientTop)
      .attr('stop-opacity', 0.95);
    gUnload
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', BARGE_CARGO_GANTT_CONFIG.drawing.unloadGradientBottom)
      .attr('stop-opacity', 0.85);

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
      .attr('fill', C_TRANS)
      .attr('opacity', 0.88);

    const topPanelG = svg.append('g').attr('transform', `translate(${LABEL_W}, 0)`);
    topPanelG
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', timelineW)
      .attr('height', dynamicPortPanelH)
      .attr('fill', chart.portPanelBg)
      .attr('opacity', 0.9);

    const axisG = svg.append('g').attr('transform', `translate(${LABEL_W}, ${dynamicPortPanelH})`);
    const dayHours = BARGE_CARGO_GANTT_CONFIG.axis.dayEveryHours;
    const axisBandTop = BARGE_CARGO_GANTT_CONFIG.axis.bandTop;
    const axisBandHeight = HEAD_H - BARGE_CARGO_GANTT_CONFIG.axis.bandBottomGap;

    for (let dayStart = 0; dayStart < data.endHour; dayStart += dayHours) {
      const dayWidthHours = Math.min(dayHours, data.endHour - dayStart);
      const x = dayStart * pxPerHour;
      const w = dayWidthHours * pxPerHour;
      const dayDate = new Date(data.startTime.getTime() + dayStart * 60 * 60 * 1000);

      axisG
        .append('rect')
        .attr('x', x)
        .attr('y', axisBandTop)
        .attr('width', w)
        .attr('height', axisBandHeight)
        .attr(
          'fill',
          (dayStart / dayHours) % 2 === 0
            ? chart.dayBandEven
            : chart.dayBandOdd,
        )
        .attr('stroke', chart.gridLineColor)
        .attr('stroke-width', BARGE_CARGO_GANTT_CONFIG.axis.borderWidth);

      axisG
        .append('text')
        .attr('x', x + BARGE_CARGO_GANTT_CONFIG.axis.dayLabelOffsetX)
        .attr('y', axisBandTop + axisBandHeight / 2)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'start')
        .attr('font-size', BARGE_CARGO_GANTT_CONFIG.axis.dayLabelFontSize)
        .attr('fill', chart.axisLabelColor)
        .text(fmtDayLabel(dayDate));
    }

    data.etdMarks.forEach((mark) => {
      const x = mark.hour * pxPerHour;
      axisG
        .append('line')
        .attr('x1', x)
        .attr('y1', HEAD_H)
        .attr('x2', x)
        .attr('y2', H - PAD_B - dynamicPortPanelH)
        .attr('stroke', C_UNLOAD)
        .attr('stroke-width', 0.8)
        .attr('stroke-dasharray', BARGE_CARGO_GANTT_CONFIG.drawing.etdDashArray)
        .attr('opacity', 0.45);

      axisG
        .append('text')
        .attr('x', x + 4)
        .attr('y', HEAD_H - 6)
        .attr('fill', C_UNLOAD)
        .attr('font-size', 8)
        .attr('opacity', 0.6)
        .text(mark.label);
    });

    const tooltip = d3.select(tooltipRef.current);
    const blockPositions: Record<
      string,
      { xMid: number; yTop: number; yBottom: number; rowTop: number; rowBottom: number }
    > = {};

    const showTip = (event: MouseEvent, ev: GanttEvent) => {
      const loadRate = ev.teu && ev.maxTeu ? `${Math.round((ev.teu / ev.maxTeu) * 100)}%` : '-';
      const html = [
        `<strong>${ev.vessel} / ${ev.voyage}</strong>`,
        `<div>类型：${ev.type}</div>`,
        `<div>港口：${ev.port}</div>`,
        `<div>时段：${fmtDate(ev.startTime)} ~ ${fmtDate(ev.endTime)}</div>`,
        `<div>TEU：${ev.teu ?? '-'}</div>`,
        `<div>积载率：${loadRate}</div>`,
      ];
      if (ev.cargo) {
        html.push(
          `<div>箱型：大箱 ${ev.cargo.big} / 小箱 ${ev.cargo.normal} / 危险品 ${ev.cargo.danger}</div>`,
          `<div>船上箱量：${ev.cargo.onboard}</div>`,
        );
      }

      tooltip
        .style('opacity', 1)
        .style('left', `${Math.min(event.clientX + 14, window.innerWidth - 320)}px`)
        .style('top', `${event.clientY - 12}px`)
        .html(html.join(''));
    };

    const hideTip = () => {
      tooltip.style('opacity', 0);
    };

    const openCargoDetail = (ev: GanttEvent, x: number, y: number) => {
      const popupWidth = 280;
      const popupHeight = 200;
      const margin = 8;

      const xCandidate = x + margin;
      const finalX =
        xCandidate + popupWidth > W - margin ? Math.max(margin, x - popupWidth - margin) : Math.max(margin, xCandidate);
      const finalY = Math.max(margin, Math.min(y, H - popupHeight - margin));

      setSelectedEvent({ event: ev, x: finalX, y: finalY });
    };

    const hasHighlight = !!highlightPortRef.current;
    const isActivePort = (port: string) => !hasHighlight || port === highlightPortRef.current;
    const eventById = new Map(data.events.map((ev) => [ev.id, ev]));

    // ── Draw port panel: one row per port ──────────────────────────────────
    topSeries.forEach((series, i) => {
      const rowTop = i * PORT_ROW_H;
      const fill = portColors.get(series.port) ?? PORT_BAND_FALLBACK;
      const stroke = d3.color(fill)?.darker(0.9).formatHex() ?? '#8f877b';
      const active = isActivePort(series.port);
      const portValues = series.points.map((p) => p.portCargo);
      const portMin = Math.min(0, d3.min(portValues) ?? 0);
      const portMax = Math.max(1, d3.max(portValues) ?? 1);
      const portDomainSpan = Math.max(1, portMax - portMin);
      const portTopY = d3
        .scaleLinear()
        .domain([portMin, portMax])
        .range([rowTop + PORT_ROW_H - 6, rowTop + 6]);
      // 零线在 Y 轴上的位置（portMin 可能为负）
      const zeroY = portTopY(0);

      // Row background
      const bgRectEl = topPanelG
        .append('rect')
        .attr('x', 0)
        .attr('y', rowTop)
        .attr('width', timelineW)
        .attr('height', PORT_ROW_H)
        .attr('fill', fill)
        .attr('opacity', active ? 0.22 : 0.06);
      highlightUpdaterRef.current.push((hp) => {
        bgRectEl.attr('opacity', !hp || series.port === hp ? 0.22 : 0.06);
      });

      // Row separator (top border)
      if (i > 0) {
        topPanelG
          .append('line')
          .attr('x1', 0)
          .attr('y1', rowTop)
          .attr('x2', timelineW)
          .attr('y2', rowTop)
          .attr('stroke', '#c9c4b9')
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.7);
      }

      // Zero baseline (may not be at row bottom when negative values exist)
      topPanelG
        .append('line')
        .attr('x1', 0)
        .attr('y1', zeroY)
        .attr('x2', timelineW)
        .attr('y2', zeroY)
        .attr('stroke', '#cfc9bd')
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '3 3')
        .attr('opacity', 0.65);

      // Filled area under the step-line
      const areaGen = d3
        .area<{ hour: number; portCargo: number }>()
        .x((p) => p.hour * pxPerHour)
        .y0(zeroY)
        .y1((p) => portTopY(p.portCargo))
        .curve(d3.curveStepAfter);
      const areaPathEl = topPanelG
        .append('path')
        .attr('d', areaGen(series.points) ?? '')
        .attr('fill', fill)
        .attr('opacity', active ? 0.4 : 0.08);
      highlightUpdaterRef.current.push((hp) => {
        areaPathEl.attr('opacity', !hp || series.port === hp ? 0.4 : 0.08);
      });

      // Step-after line
      const lineGen = d3
        .line<{ hour: number; portCargo: number }>()
        .x((p) => p.hour * pxPerHour)
        .y((p) => portTopY(p.portCargo))
        .curve(d3.curveStepAfter);
      const linePathEl = topPanelG
        .append('path')
        .attr('d', lineGen(series.points) ?? '')
        .attr('fill', 'none')
        .attr('stroke', stroke)
        .attr('stroke-width', active ? 1.5 : 0.8)
        .attr('opacity', active ? 0.88 : 0.22);
      highlightUpdaterRef.current.push((hp) => {
        const a = !hp || series.port === hp;
        linePathEl.attr('stroke-width', a ? 1.5 : 0.8).attr('opacity', a ? 0.88 : 0.22);
      });

      // Port name label (left)
      const portLabelEl = topPanelG
        .append('text')
        .attr('x', 8)
        .attr('y', rowTop + PORT_ROW_H / 2)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .attr('fill', stroke)
        .attr('opacity', active ? 0.88 : 0.28)
        .text(series.port);
      highlightUpdaterRef.current.push((hp) => {
        portLabelEl.attr('opacity', !hp || series.port === hp ? 0.88 : 0.28);
      });

      // Value-range annotation (top-right)
      const maxLabelEl = topPanelG
        .append('text')
        .attr('x', timelineW - 6)
        .attr('y', rowTop + 9)
        .attr('text-anchor', 'end')
        .attr('font-size', 8)
        .attr('fill', stroke)
        .attr('opacity', active ? 0.48 : 0.14)
        .text(portMin < 0 ? `${portMin}~+${portMax}` : `↑ ${portMax}`);
      highlightUpdaterRef.current.push((hp) => {
        maxLabelEl.attr('opacity', !hp || series.port === hp ? 0.48 : 0.14);
      });
      void portDomainSpan; // suppress unused warning
    });

    // Panel section label (top-right corner)
    topPanelG
      .append('text')
      .attr('x', timelineW - 6)
      .attr('y', 9)
      .attr('text-anchor', 'end')
      .attr('font-size', 9)
      .attr('fill', '#7f776d')
      .attr('font-weight', 600)
      .attr('opacity', 0.55)
      .text('港口货箱库存变化');

    // Separator between port panel and barge rows
    svg
      .append('line')
      .attr('x1', LABEL_W)
      .attr('y1', dynamicPortPanelH)
      .attr('x2', LABEL_W + timelineW)
      .attr('y2', dynamicPortPanelH)
      .attr('stroke', '#c9c4b9')
      .attr('stroke-width', 1)
      .attr('opacity', 0.9);

    data.ships.forEach((ship, index) => {
      const rowY = rowAreaTopY + index * rowH;
      const rowG = svg.append('g').attr('transform', `translate(0, ${rowY})`);
      const areaG = rowG.append('g').attr('transform', `translate(${LABEL_W}, 0)`);
      const portStaySegments = buildShipPortStaySegments(ship.events);

      const portBandG = areaG.append('g');
      portStaySegments.forEach((segment) => {
        const x = segment.startHour * pxPerHour;
        const bandW = Math.max(1, (segment.endHour - segment.startHour) * pxPerHour);
        const fill = portColors.get(segment.port) ?? PORT_BAND_FALLBACK;
        const stroke = d3.color(fill)?.darker(0.7).formatHex() ?? '#b9b2a6';
        const active = isActivePort(segment.port);

        // 聚合该港口停靠区间内所有装卸事件的货箱明细
        const portCargoEvents = ship.events.filter(
          (ev) =>
            ev.port === segment.port &&
            (ev.type === 'loading' || ev.type === 'unloading') &&
            ev.startHour >= segment.startHour - 1e-6 &&
            ev.endHour <= segment.endHour + 1e-6,
        );
        const groupMap = new Map<string, { teu: number; count: number; sampleContainers: string[] }>();
        portCargoEvents.forEach((ev) => {
          ev.cargoDetail?.groups.forEach((g) => {
            const existing = groupMap.get(g.mainlinePort);
            if (existing) {
              existing.teu += g.teu;
              existing.count += g.count;
            } else {
              groupMap.set(g.mainlinePort, { teu: g.teu, count: g.count, sampleContainers: [...g.sampleContainers] });
            }
          });
        });
        const aggregatedGroups = Array.from(groupMap.entries()).map(([mainlinePort, d]) => ({
          mainlinePort,
          teu: d.teu,
          count: d.count,
          sampleContainers: d.sampleContainers,
        }));
        const aggTotalTeu = aggregatedGroups.reduce((s, g) => s + g.teu, 0);
        const aggTotalCount = aggregatedGroups.reduce((s, g) => s + g.count, 0);
        const portSyntheticEvent: GanttEvent = {
          id: `port-bg-${ship.id}-${segment.port}-${segment.startHour}`,
          shipId: ship.id,
          vessel: ship.vessel,
          voyage: ship.voyage,
          port: segment.port,
          type: 'loading' as const,
          startTime: new Date(data.startTime.getTime() + segment.startHour * 3600000),
          endTime: new Date(data.startTime.getTime() + segment.endHour * 3600000),
          startHour: segment.startHour,
          endHour: segment.endHour,
          cargoDetail:
            aggregatedGroups.length > 0
              ? { totalTeu: aggTotalTeu, totalCount: aggTotalCount, groups: aggregatedGroups }
              : undefined,
        };

        const bandRectEl = portBandG
          .append('rect')
          .attr('x', x)
          .attr('y', PORT_BAND_Y_INSET)
          .attr('width', bandW)
          .attr('height', Math.max(1, rowH - PORT_BAND_Y_INSET * 2))
          .attr('fill', fill)
          .attr('stroke', stroke)
          .attr('stroke-width', PORT_BAND_STROKE_WIDTH)
          .attr('stroke-opacity', active ? 0.35 : 0.14)
          .attr('opacity', active ? PORT_BAND_ACTIVE_OPACITY : PORT_BAND_INACTIVE_OPACITY)
          .style('cursor', 'pointer')
          .on('mousemove', (e: MouseEvent) => showTip(e, portSyntheticEvent))
          .on('mouseleave', hideTip)
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            hideTip();
            openCargoDetail(portSyntheticEvent, LABEL_W + x + bandW / 2, rowY + rowH / 2);
            onBarClickRef.current?.(portSyntheticEvent);
          });
        highlightUpdaterRef.current.push((hp) => {
          const a = !hp || segment.port === hp;
          bandRectEl.attr('stroke-opacity', a ? 0.35 : 0.14).attr('opacity', a ? PORT_BAND_ACTIVE_OPACITY : PORT_BAND_INACTIVE_OPACITY);
        });
      });

      rowG
        .append('line')
        .attr('x1', 0)
        .attr('y1', rowH)
        .attr('x2', W)
        .attr('y2', rowH)
        .attr('stroke', '#dbd8d0')
        .attr('stroke-width', 0.5);

      const labelG = areaG.append('g').attr('transform', 'translate(8, 9)').style('pointer-events', 'none');
      labelG
        .append('text')
        .attr('text-anchor', 'start')
        .attr('y', 0)
        .attr('dominant-baseline', 'hanging')
        .attr('font-size', 12)
        .attr('font-weight', 700)
        .attr('letter-spacing', '0.01em')
        .attr('fill', '#8f877b')
        .attr('opacity', 0.28)
        .text(ship.vessel);

      labelG
        .append('text')
        .attr('text-anchor', 'start')
        .attr('y', 14)
        .attr('dominant-baseline', 'hanging')
        .attr('font-size', 9)
        .attr('font-weight', 500)
        .attr('fill', '#9d9589')
        .attr('opacity', 0.24)
        .text(`${ship.voyage || ship.id} · ${ship.from}`);

      const minStart = d3.min(ship.events, (ev) => ev.startHour) ?? 0;
      const maxEnd = d3.max(ship.events, (ev) => ev.endHour) ?? minStart;

      areaG
        .append('line')
        .attr('x1', minStart * pxPerHour)
        .attr('y1', sailY)
        .attr('x2', maxEnd * pxPerHour)
        .attr('y2', sailY)
        .attr('stroke', C_SAIL)
        .attr('stroke-width', 1)
        .attr('opacity', 0.25);

      const sailingEvents = ship.events.filter((ev) => ev.type === 'sailing');
      const idleEvents = ship.events.filter((ev) => ev.type === 'waiting' || ev.type === 'wrapup');
      const cargoEvents = ship.events.filter((ev) => ev.type === 'loading' || ev.type === 'unloading');

      const drawNonCargoSegment = (ev: GanttEvent, activeOpacity: number, inactiveOpacity: number) => {
        const active = isActivePort(ev.port);
        const segLineEl = areaG
          .append('line')
          .attr('x1', ev.startHour * pxPerHour)
          .attr('y1', sailY)
          .attr('x2', ev.endHour * pxPerHour)
          .attr('y2', sailY)
          .attr('stroke', C_SAIL)
          .attr('stroke-width', BARGE_CARGO_GANTT_CONFIG.drawing.nonCargoLineWidth)
          .attr('stroke-linecap', 'round')
          .attr('opacity', active ? activeOpacity : inactiveOpacity)
          .on('mousemove', (e: MouseEvent) => showTip(e, ev))
          .on('mouseleave', hideTip);
        highlightUpdaterRef.current.push((hp) => {
          segLineEl.attr('opacity', !hp || ev.port === hp ? activeOpacity : inactiveOpacity);
        });
      };

      sailingEvents.forEach((ev) => {
        const active = isActivePort(ev.port);
        const x1 = ev.startHour * pxPerHour;
        const x2 = ev.endHour * pxPerHour;
        const segW = x2 - x1;

        drawNonCargoSegment(ev, 0.55, 0.12);

        if (
          ev.cargo &&
          ev.maxTeu &&
          segW >= donutOuterRadius * BARGE_CARGO_GANTT_CONFIG.donut.minSegmentWidthFactor
        ) {
          const midX = (x1 + x2) / 2;
          const total = ev.cargo.big + ev.cargo.normal + ev.cargo.danger;
          const onboardTeu = ev.teu ?? ev.cargo.onboard;
          const stowRate = Math.max(0, Math.min(1, onboardTeu / ev.maxTeu));

          const donutG = areaG
            .append('g')
            .attr('transform', `translate(${midX}, ${sailY})`)
            .attr('opacity', active ? 1 : 0.22);
          highlightUpdaterRef.current.push((hp) => {
            donutG.attr('opacity', !hp || ev.port === hp ? 1 : 0.22);
          });

          donutG
            .append('circle')
            .attr('r', donutOuterRadius + 1)
            .attr('fill', index % 2 === 0 ? '#f8f7f4' : '#f2f0ec');

          if (total > 0) {
            const segments = [
              { val: ev.cargo.big, color: C_CARGO_BIG },
              { val: ev.cargo.normal, color: C_CARGO_NORMAL },
              { val: ev.cargo.danger, color: C_CARGO_DANGER },
            ].filter((s) => s.val > 0);

            let angle = -Math.PI / 2;
            const gap = total > 1 ? BARGE_CARGO_GANTT_CONFIG.donut.segmentGap : 0;

            segments.forEach((seg) => {
              const sweep = (seg.val / total) * Math.PI * 2 - gap;
              const arcPath = d3
                .arc<d3.DefaultArcObject>()
                .cornerRadius(BARGE_CARGO_GANTT_CONFIG.donut.cornerRadius)({
                  innerRadius: donutInnerRadius,
                  outerRadius: donutOuterRadius,
                  startAngle: angle + gap / 2,
                  endAngle: angle + gap / 2 + sweep,
                  padAngle: 0,
                });

              donutG
                .append('path')
                .attr('d', arcPath ?? '')
                .attr('fill', seg.color)
                .attr('opacity', 0.78);

              angle += sweep + gap;
            });
          }

          const stowArc = d3.arc<d3.DefaultArcObject>()({
            innerRadius: donutInnerRadius - stowInnerOffset,
            outerRadius: donutInnerRadius - stowOuterOffset,
            startAngle: -Math.PI / 2,
            endAngle: -Math.PI / 2 + stowRate * Math.PI * 2,
            padAngle: 0,
          });

          donutG.append('path').attr('d', stowArc ?? '').attr('fill', C_SAIL).attr('opacity', 0.42);
          donutG
            .append('circle')
            .attr('r', donutInnerRadius - 1)
            .attr('fill', index % 2 === 0 ? '#f8f7f4' : '#f2f0ec');

          donutG
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('x', 0)
            .attr('y', 0)
            .attr('fill', '#4a4540')
            .attr('font-size', Math.max(7, Math.min(12, donutOuterRadius * 0.5)))
            .attr('font-weight', 600)
            .text(`${Math.round(stowRate * 100)}%`);
        }
      });

      idleEvents.forEach((ev) => {
        drawNonCargoSegment(ev, 0.5, 0.1);
      });

      cargoEvents.forEach((ev) => {
        const active = isActivePort(ev.port);
        const x = ev.startHour * pxPerHour;
        const bw = Math.max((ev.endHour - ev.startHour) * pxPerHour, MIN_BLOCK_W);
        const isLoading = ev.type === 'loading';
        const fallbackBlockH = Math.max(minBlockH, Math.min(BLOCK_H, maxBlockH));
        const scaledBlockH = ship.maxTeu > 0 && typeof ev.teu === 'number' ? (ev.teu / ship.maxTeu) * maxBlockH : minBlockH;
        const blockH =
          typeof ev.teu === 'number' && ev.teu >= 0
            ? Math.max(minBlockH, Math.min(maxBlockH, scaledBlockH))
            : fallbackBlockH;
        const blockY = isLoading ? sailY - blockH : sailY;
        const stroke = isLoading ? C_LOAD : C_UNLOAD;
        const grad = isLoading ? 'url(#bcgv-load)' : 'url(#bcgv-unload)';

        const shadowRectEl = areaG
          .append('rect')
          .attr('x', x + 1)
          .attr('y', blockY + 1)
          .attr('width', bw)
          .attr('height', blockH)
          .attr('rx', BLOCK_RADIUS)
          .attr('fill', stroke)
          .attr('opacity', active ? 0.06 : 0.02);
        highlightUpdaterRef.current.push((hp) => {
          shadowRectEl.attr('opacity', !hp || ev.port === hp ? 0.06 : 0.02);
        });

        const mainRectEl = areaG
          .append('rect')
          .attr('x', x)
          .attr('y', blockY)
          .attr('width', bw)
          .attr('height', blockH)
          .attr('rx', BLOCK_RADIUS)
          .attr('fill', grad)
          .attr('stroke', stroke)
          .attr('stroke-width', active ? 1.1 : 0.6)
          .attr('stroke-opacity', active ? 0.9 : 0.2)
          .attr('opacity', active ? 1 : 0.28)
          .on('mousemove', (e: MouseEvent) => showTip(e, ev))
          .on('mouseleave', hideTip)
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            hideTip();
            onBarClickRef.current?.(ev);
          });
        highlightUpdaterRef.current.push((hp) => {
          const a = !hp || ev.port === hp;
          mainRectEl.attr('stroke-width', a ? 1.1 : 0.6).attr('stroke-opacity', a ? 0.9 : 0.2).attr('opacity', a ? 1 : 0.28);
        });

        if (typeof ev.teu === 'number') {
          const teuTextEl = areaG
            .append('text')
            .attr('x', x + bw / 2)
            .attr('y', isLoading ? loadAmountLabelY : unloadAmountLabelY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', isLoading ? 'hanging' : 'auto')
            .attr('font-size', 8)
            .attr('font-weight', 600)
            .attr('fill', stroke)
            .attr('opacity', active ? 0.9 : 0.35)
            .text(`${ev.teu}`);
          highlightUpdaterRef.current.push((hp) => {
            teuTextEl.attr('opacity', !hp || ev.port === hp ? 0.9 : 0.35);
          });
        }

        blockPositions[ev.id] = {
          xMid: LABEL_W + x + bw / 2,
          yTop: rowY + blockY,
          yBottom: rowY + blockY + blockH,
          rowTop: rowY,
          rowBottom: rowY + rowH,
        };
      });
    });

    data.transshipConnections.forEach((tc) => {
      const from = blockPositions[tc.fromEventId];
      const to = blockPositions[tc.toEventId];
      if (!from || !to) return;

      const fromEvent = eventById.get(tc.fromEventId);
      const toEvent = eventById.get(tc.toEventId);
      const active = !hasHighlight || isActivePort(fromEvent?.port ?? '') || isActivePort(toEvent?.port ?? '');

      const x1 = from.xMid;
      let y1 = from.yBottom;
      const x2 = to.xMid;
      let y2 = to.yTop;

      if (from.yTop > to.yTop) {
        y1 = from.yTop;
        y2 = to.yBottom;
      }

      const startRowBoundaryY = y2 >= y1 ? from.rowBottom : from.rowTop;
      const polylinePoints = [
        `${x1},${y1}`,
        `${x1},${startRowBoundaryY}`,
        `${x2},${startRowBoundaryY}`,
        `${x2},${y2}`,
      ].join(' ');

      const transferHours =
        fromEvent && toEvent
          ? Math.max(0, (toEvent.endTime.getTime() - fromEvent.endTime.getTime()) / (60 * 60 * 1000))
          : 0;

      const connG = svg.append('g');
      const transPolylineEl = connG
        .append('polyline')
        .attr('points', polylinePoints)
        .attr('fill', 'none')
        .attr('stroke', C_TRANS)
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', BARGE_CARGO_GANTT_CONFIG.drawing.transshipDashArray)
        .attr('marker-end', 'url(#bcgv-transship-arrow)')
        .attr('opacity', active ? 0.68 : 0.14);

      const transTextEl = connG
        .append('text')
        .attr('x', (x1 + x2) / 2)
        .attr('y', startRowBoundaryY - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', 8)
        .attr('fill', C_TRANS)
        .attr('opacity', active ? 1 : 0.22)
        .text(`${tc.teu} TEU · ${fmtHours(transferHours)}h`);

      highlightUpdaterRef.current.push((hp) => {
        const a = !hp || fromEvent?.port === hp || toEvent?.port === hp;
        transPolylineEl.attr('opacity', a ? 0.68 : 0.14);
        transTextEl.attr('opacity', a ? 1 : 0.22);
      });
    });

    svg.on('click', () => {
      setSelectedEvent(null);
      hideTip();
    });
  }, [data, width, chartHeight, portColorMap, chart]);

  // 高亮港口变化时，仅更新已有元素透明度，不触发全量重绘
  useEffect(() => {
    highlightUpdaterRef.current.forEach((fn) => fn(highlightPort));
  }, [highlightPort]);

  const selectedGroups = selectedEvent?.event.cargoDetail?.groups ?? [];
  const maxGroupCount = selectedGroups.reduce((m, g) => Math.max(m, g.count), 0);

  return (
    <div
      className={styles.container}
      style={{
        width: Math.max(width, LABEL_W + PAD_R + 1),
        height: height ? Math.max(height, 1) : undefined,
      }}
    >
      {loading && <div className={styles.loading}>正在加载仿真数据...</div>}

      <div className={styles.wrap} style={{ height: chartHeight }} onClick={() => setSelectedEvent(null)}>
        <svg ref={svgRef} />
        {selectedEvent && (
          <div
            className={styles.cargoPopup}
            style={{ left: selectedEvent.x, top: selectedEvent.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.cargoPopupHeader}>
              <div className={styles.cargoPopupPortName}>{selectedEvent.event.port}</div>
              <button className={styles.cargoPopupClose} onClick={() => setSelectedEvent(null)} title="关闭">
                ×
              </button>
            </div>

            <div className={styles.cargoPopupMeta}>
              <span>{selectedEvent.event.vessel}</span>
              <span>{selectedEvent.event.voyage}</span>
            </div>

            {selectedGroups.length === 0 ? (
              <div className={styles.cargoPopupEmpty}>暂无装货明细数据</div>
            ) : (
              <div className={styles.portBarChart}>
                {selectedGroups.map((group) => {
                  const pct = maxGroupCount > 0 ? (group.count / maxGroupCount) * 100 : 0;
                  const color = resolvePortColor(group.mainlinePort, portColorMap);
                  return (
                    <div key={group.mainlinePort} className={styles.portBarChartRow}>
                      <div className={styles.portBarChartTrack}>
                        <div
                          className={styles.portBarChartFill}
                          style={{ width: `${pct}%`, background: color }}
                          title={`${group.mainlinePort}：${group.count} 箱 · ${fmtHours(group.teu)} TEU`}
                        >
                          <span className={styles.portBarChartBarLabel}>{group.mainlinePort}</span>
                        </div>
                      </div>
                      <div className={styles.portBarChartValue}>{group.count} 箱/ {fmtHours(group.teu)} TEU</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={tooltipRef} className={styles.tooltip} />
    </div>
  );
}
