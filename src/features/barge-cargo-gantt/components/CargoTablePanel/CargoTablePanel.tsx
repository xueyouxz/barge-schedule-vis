import { useCallback, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useTheme } from '@/shared/theme'
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable'
import type { GanttEvent } from '../BargeCargoGanttView/types'
import { resolvePortColor } from '@/shared/lib/portColors'
import styles from './CargoTablePanel.module.css'

export interface CargoTablePanelProps {
  event: GanttEvent | null
  containerRecordsPath?: string
  onClose?: () => void
}

type ContainerRecordRow = {
  箱号?: string
  船名?: string
  航次?: string
  实际离港时间?: string
  ['进出口（I/O）']?: string
  ['L/F/E']?: string
  危类?: string
  箱主?: string
  ['内外贸（D/F）']?: string
  重量?: string
  TEU?: string
  起运港码头?: string
  目的港码头?: string
  干线船名?: string
  干线航次?: string
  干线码头?: string
  ETD?: string
  箱就绪时间?: string
  是否中转?: string
  route?: string
  current_leg?: string
  status?: string
  location?: string
}

type LabelValueRow = { label: string; value: string }

const DEFAULT_CONTAINER_RECORDS_PATH = '/data/output/2026-01-13 17-20-38/container_records.csv'

function fmt(value: number | undefined): string {
  if (value === undefined || value === null) return '-'
  const formatted = value.toFixed(1)
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted
}

function fmtNum(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '-'

  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numeric)) return String(value)

  return fmt(numeric)
}

function withAlpha(hexColor: string, alpha = 0.25): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#')) return hexColor

  const hex = normalized.slice(1)
  const isShort = hex.length === 3
  const isLong = hex.length === 6
  if (!isShort && !isLong) return hexColor

  const full = isShort ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex

  const red = Number.parseInt(full.slice(0, 2), 16)
  const green = Number.parseInt(full.slice(2, 4), 16)
  const blue = Number.parseInt(full.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getReadableTextColor(hexColor: string): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#')) return 'var(--chart-text)'

  const hex = normalized.slice(1)
  const isShort = hex.length === 3
  const isLong = hex.length === 6
  if (!isShort && !isLong) return 'var(--chart-text)'

  const full = isShort ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex

  const red = Number.parseInt(full.slice(0, 2), 16)
  const green = Number.parseInt(full.slice(2, 4), 16)
  const blue = Number.parseInt(full.slice(4, 6), 16)
  const yiq = (red * 299 + green * 587 + blue * 114) / 1000

  return yiq >= 140 ? '#2a2520' : '#ffffff'
}

function parseRoutePath(routeRaw?: string): string[] {
  if (!routeRaw) return []

  const matches = routeRaw.match(/'([^']+)'/g)
  if (!matches) return []

  return matches
    .map(segment => segment.replace(/'/g, ''))
    .filter((value, index, array) => value && (index === 0 || value !== array[index - 1]))
}

function parseDateTime(value: string | undefined): number {
  if (!value) return Number.NaN

  const matched = value
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (!matched) return Number.NaN

  const [, year, month, day, hour, minute, second] = matched
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime()
}

function formatEventTimeRange(event: GanttEvent): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return `${formatter.format(event.startTime)} - ${formatter.format(event.endTime)}`
}

function getEventTypeLabel(eventType: GanttEvent['type']): string {
  switch (eventType) {
    case 'loading':
      return '装货'
    case 'unloading':
      return '卸货'
    case 'waiting':
      return '等待'
    case 'wrapup':
      return '收尾'
    case 'sailing':
      return '航行'
    default:
      return eventType
  }
}

export default function CargoTablePanel({
  event,
  containerRecordsPath,
  onClose
}: CargoTablePanelProps) {
  const { theme } = useTheme()
  const [rows, setRows] = useState<ContainerRecordRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadRows = async () => {
      setLoadingRows(true)
      setRowsError(null)

      try {
        const url = containerRecordsPath ?? DEFAULT_CONTAINER_RECORDS_PATH
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const text = await response.text()
        const parsed = d3.csvParse(text) as unknown as ContainerRecordRow[]

        if (active) {
          setRows(parsed)
        }
      } catch (error) {
        if (active) {
          setRows([])
          setRowsError(error instanceof Error ? error.message : '加载失败')
        }
      } finally {
        if (active) {
          setLoadingRows(false)
        }
      }
    }

    loadRows()

    return () => {
      active = false
    }
  }, [containerRecordsPath])

  const filteredRows = useMemo(() => {
    if (!event) return []

    const isPortMatched = (row: ContainerRecordRow) => {
      const portId = event.port
      return row.起运港码头 === portId || row.目的港码头 === portId || row.location === portId
    }

    return rows.filter(
      row => row.船名 === event.vessel && row.航次 === event.voyage && isPortMatched(row)
    )
  }, [rows, event])

  const stats = useMemo(() => {
    const total = filteredRows.length
    const exportCount = filteredRows.filter(row => row['进出口（I/O）'] === 'O').length
    const importCount = filteredRows.filter(row => row['进出口（I/O）'] === 'I').length
    const finishCount = filteredRows.filter(row => row.status === 'finish').length

    return {
      total,
      exportCount,
      importCount,
      finishRate: total > 0 ? `${Math.round((finishCount / total) * 100)}%` : '-'
    }
  }, [filteredRows])

  const cargoMetricRows = useMemo(() => {
    if (!event) return []

    if (event.type === 'loading') {
      return [
        { label: '装货 TEU', value: fmt(event.teu ?? event.cargoDetail?.totalTeu) },
        ...(event.cargoDetail
          ? [
              { label: '关联箱量', value: `${event.cargoDetail.totalCount}` },
              { label: '干线港分组', value: `${event.cargoDetail.groups.length}` }
            ]
          : []),
        ...(event.maxTeu !== undefined ? [{ label: '船舶最大载量', value: fmt(event.maxTeu) }] : [])
      ]
    }

    if (event.type === 'unloading') {
      return [
        { label: '卸货 TEU', value: fmt(event.teu ?? event.cargoDetail?.totalTeu) },
        ...(event.cargoDetail
          ? [
              { label: '关联箱量', value: `${event.cargoDetail.totalCount}` },
              { label: '干线港分组', value: `${event.cargoDetail.groups.length}` }
            ]
          : []),
        ...(event.maxTeu !== undefined ? [{ label: '船舶最大载量', value: fmt(event.maxTeu) }] : [])
      ]
    }

    return []
  }, [event])

  const onboardRows = useMemo<LabelValueRow[]>(() => {
    if (!event?.cargo) {
      return []
    }

    return [
      { label: '大型箱', value: fmt(event.cargo.big) },
      { label: '普通箱', value: fmt(event.cargo.normal) },
      { label: '危险品箱', value: fmt(event.cargo.danger) },
      { label: '合计在船', value: fmt(event.cargo.onboard) }
    ]
  }, [event])

  const getPortTagStyle = useCallback(
    (portId?: string) => {
      const text = (portId || '').trim()
      if (!text) return undefined

      const color = resolvePortColor(text, theme)
      return {
        backgroundColor: withAlpha(color, 0.28),
        borderColor: withAlpha(color, 0.65),
        color: getReadableTextColor(color)
      }
    },
    [theme]
  )

  const cargoMetricColumns = useMemo<DataTableColumn<LabelValueRow>[]>(
    () => [
      { key: 'label', header: '指标', accessor: 'label' },
      {
        key: 'value',
        header: '数值',
        accessor: 'value',
        align: 'right',
        headerAlign: 'right',
        className: styles.number
      }
    ],
    []
  )

  const onboardColumns = useMemo<DataTableColumn<LabelValueRow>[]>(
    () => [
      {
        key: 'label',
        header: '类型',
        renderCell: row => (row.label === '合计在船' ? <strong>{row.label}</strong> : row.label)
      },
      {
        key: 'value',
        header: '在船',
        align: 'right',
        headerAlign: 'right',
        className: styles.number,
        renderCell: row => (row.label === '合计在船' ? <strong>{row.value}</strong> : row.value)
      }
    ],
    []
  )

  const containerColumns = useMemo<DataTableColumn<ContainerRecordRow>[]>(
    () => [
      {
        key: '箱号',
        header: '箱号',
        className: styles.mono,
        renderCell: row => row.箱号 || '-'
      },
      {
        key: '实际离港时间',
        header: '实际离港时间',
        sortable: true,
        sortAccessor: row => {
          const timestamp = parseDateTime(row.实际离港时间)
          return Number.isNaN(timestamp) ? null : timestamp
        },
        renderCell: row => row.实际离港时间 || '-'
      },
      {
        key: 'L/F/E',
        header: 'L/F/E',
        align: 'center',
        headerAlign: 'center',
        renderCell: row => (
          <span className={`${styles.badge} ${styles.badgeType}`}>{row['L/F/E'] || '-'}</span>
        )
      },
      {
        key: '危类',
        header: '危类',
        align: 'center',
        headerAlign: 'center',
        renderCell: row => row.危类 || '-'
      },
      { key: '箱主', header: '箱主', renderCell: row => row.箱主 || '-' },
      {
        key: '内外贸（D/F）',
        header: '内外贸（D/F）',
        align: 'center',
        headerAlign: 'center',
        renderCell: row => row['内外贸（D/F）'] || '-'
      },
      {
        key: '起运港码头',
        header: '起运港码头',
        minWidth: 92,
        renderCell: row => (
          <span className={styles.portTag} style={getPortTagStyle(row.起运港码头)}>
            {row.起运港码头 || '-'}
          </span>
        )
      },
      {
        key: '目的港码头',
        header: '目的港码头',
        minWidth: 92,
        renderCell: row => (
          <span className={styles.portTag} style={getPortTagStyle(row.目的港码头)}>
            {row.目的港码头 || '-'}
          </span>
        )
      },
      { key: '干线船名', header: '干线船名', renderCell: row => row.干线船名 || '-' },
      { key: '干线航次', header: '干线航次', renderCell: row => row.干线航次 || '-' },
      {
        key: '干线码头',
        header: '干线码头',
        minWidth: 92,
        renderCell: row => (
          <span className={styles.portTag} style={getPortTagStyle(row.干线码头)}>
            {row.干线码头 || '-'}
          </span>
        )
      },
      {
        key: '重量',
        header: '重量',
        align: 'right',
        headerAlign: 'right',
        className: styles.number,
        renderCell: row => fmtNum(row.重量)
      },
      {
        key: 'TEU',
        header: 'TEU',
        align: 'right',
        headerAlign: 'right',
        className: styles.number,
        renderCell: row => fmtNum(row.TEU)
      },
      {
        key: 'ETD',
        header: 'ETD',
        sortable: true,
        sortAccessor: row => {
          const timestamp = parseDateTime(row.ETD)
          return Number.isNaN(timestamp) ? null : timestamp
        },
        renderCell: row => row.ETD || '-'
      },
      {
        key: '箱就绪时间',
        header: '箱就绪时间',
        sortable: true,
        sortAccessor: row => {
          const timestamp = parseDateTime(row.箱就绪时间)
          return Number.isNaN(timestamp) ? null : timestamp
        },
        renderCell: row => row.箱就绪时间 || '-'
      },
      {
        key: '是否中转',
        header: '是否中转',
        align: 'center',
        headerAlign: 'center',
        renderCell: row => row.是否中转 || '-'
      },
      {
        key: 'route',
        header: 'route',
        minWidth: 180,
        renderCell: row => {
          const routePorts = parseRoutePath(row.route)

          if (routePorts.length === 0) {
            return '-'
          }

          return (
            <div className={styles.routePath}>
              {routePorts.map((port, index, array) => (
                <div className={styles.routeNodeWrap} key={`${row.箱号}-route-${index}`}>
                  <span className={styles.routeNode} style={getPortTagStyle(port)}>
                    {port}
                  </span>
                  {index < array.length - 1 && (
                    <svg className={styles.routeIcon} viewBox='0 0 16 16' aria-hidden='true'>
                      <path
                        d='M2 8h10'
                        stroke='currentColor'
                        strokeLinecap='round'
                        strokeWidth='1.6'
                      />
                      <path
                        d='M9 4l4 4-4 4'
                        fill='none'
                        stroke='currentColor'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='1.6'
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )
        }
      },
      {
        key: 'current_leg',
        header: 'current_leg',
        align: 'center',
        headerAlign: 'center',
        renderCell: row => row.current_leg || '-'
      },
      {
        key: 'location',
        header: 'location',
        minWidth: 92,
        renderCell: row => (
          <span className={styles.portTag} style={getPortTagStyle(row.location)}>
            {row.location || '-'}
          </span>
        )
      },
      {
        key: '状态',
        header: '状态',
        align: 'center',
        headerAlign: 'center',
        renderCell: row => (
          <span
            className={`${styles.badge} ${row.status === 'finish' ? styles.badgeDone : styles.badgePending}`}
          >
            {row.status || '-'}
          </span>
        )
      }
    ],
    [getPortTagStyle]
  )

  if (!event) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📦</span>
          <span>点击上方甘特图中的港口带或装卸货条形以查看货箱详情</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>
          ⚓
          <span className={styles.portTag} style={getPortTagStyle(event.port)}>
            {event.port || '-'}
          </span>
        </h3>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose} title='关闭' type='button'>
            ×
          </button>
        )}
      </div>

      <div className={styles.meta}>
        <span className={`${styles.metaTag} ${styles.metaTagBarge}`}>
          {event.vessel} · {event.voyage}
        </span>
        <span className={`${styles.metaTag} ${styles.metaTagPort}`}>
          {getEventTypeLabel(event.type)}
        </span>
        <span>{formatEventTimeRange(event)}</span>
      </div>

      <div className={styles.summaryText}>
        货箱数：{stats.total}，出口：{stats.exportCount}，进口：{stats.importCount}，完成率：
        {stats.finishRate}
      </div>

      {cargoMetricRows.length > 0 && (
        <div className={styles.section}>
          <h4
            className={`${styles.sectionTitle} ${
              event.type === 'unloading' ? styles.sectionTitleUnload : styles.sectionTitleLoad
            }`}
          >
            {event.type === 'unloading' ? '卸货明细' : '装货明细'}
          </h4>
          <DataTable
            columns={cargoMetricColumns}
            rows={cargoMetricRows}
            getRowKey={row => row.label}
          />
        </div>
      )}

      {event.cargo && (
        <div className={styles.section}>
          <h4 className={`${styles.sectionTitle} ${styles.sectionTitleOnboard}`}>船上货物状态</h4>
          <DataTable columns={onboardColumns} rows={onboardRows} getRowKey={row => row.label} />
        </div>
      )}

      <div className={styles.section}>
        <h4 className={`${styles.sectionTitle} ${styles.sectionTitleContainer}`}>货箱明细</h4>
        {loadingRows && <div className={styles.stateText}>正在加载货箱数据…</div>}
        {!loadingRows && rowsError && (
          <div className={styles.stateText}>货箱数据加载失败：{rowsError}</div>
        )}
        {!loadingRows && !rowsError && (
          <div>
            <DataTable
              columns={containerColumns}
              rows={filteredRows}
              getRowKey={row => `${row.箱号}-${row.ETD}`}
              enableSearch
              searchPlaceholder='搜索任意字段（箱号/航次/码头/状态等）'
              emptyText={({ searchKeyword }) =>
                searchKeyword
                  ? `未找到匹配“${searchKeyword}”的记录`
                  : '当前驳船在该港口暂无匹配货箱记录'
              }
              enablePagination
              defaultPageSize={50}
              pageSizeOptions={[20, 50, 100]}
              defaultSort={{ columnKey: '实际离港时间', order: 'asc' }}
              maxHeight={380}
              stickyHeader
              virtualized
              rowHeight={38}
            />
          </div>
        )}
      </div>
    </div>
  )
}
