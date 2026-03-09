import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useTheme } from '@/shared/theme'
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

type TimeSortField = '实际离港时间' | 'ETD' | '箱就绪时间'
type SortOrder = 'asc' | 'desc'

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
  const [searchKeyword, setSearchKeyword] = useState('')
  const [timeSortField, setTimeSortField] = useState<TimeSortField>('实际离港时间')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
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

  useEffect(() => {
    setSearchKeyword('')
    setTimeSortField('实际离港时间')
    setSortOrder('asc')
  }, [event?.id])

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

  const searchedRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (!keyword) return filteredRows

    return filteredRows.filter(row =>
      Object.values(row).some(value =>
        String(value ?? '')
          .toLowerCase()
          .includes(keyword)
      )
    )
  }, [filteredRows, searchKeyword])

  const sortedRows = useMemo(() => {
    const copied = [...searchedRows]

    copied.sort((rowA, rowB) => {
      const timeA = parseDateTime(rowA[timeSortField])
      const timeB = parseDateTime(rowB[timeSortField])
      const aInvalid = Number.isNaN(timeA)
      const bInvalid = Number.isNaN(timeB)

      if (aInvalid && bInvalid) return 0
      if (aInvalid) return 1
      if (bInvalid) return -1

      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
    })

    return copied
  }, [searchedRows, timeSortField, sortOrder])

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

  const handleSortTimeField = (field: TimeSortField) => {
    if (timeSortField === field) {
      setSortOrder(previous => (previous === 'asc' ? 'desc' : 'asc'))
      return
    }

    setTimeSortField(field)
    setSortOrder('asc')
  }

  const renderSortMark = (field: TimeSortField): string => {
    if (timeSortField !== field) return '↕'
    return sortOrder === 'asc' ? '▲' : '▼'
  }

  const getPortTagStyle = (portId?: string) => {
    const text = (portId || '').trim()
    if (!text) return undefined

    const color = resolvePortColor(text, theme)
    return {
      backgroundColor: withAlpha(color, 0.28),
      borderColor: withAlpha(color, 0.65),
      color: getReadableTextColor(color)
    }
  }

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
          <table className={styles.table}>
            <thead>
              <tr>
                <th>指标</th>
                <th style={{ textAlign: 'right' }}>数值</th>
              </tr>
            </thead>
            <tbody>
              {cargoMetricRows.map(row => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={styles.number}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {event.cargo && (
        <div className={styles.section}>
          <h4 className={`${styles.sectionTitle} ${styles.sectionTitleOnboard}`}>船上货物状态</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>类型</th>
                <th style={{ textAlign: 'right' }}>在船</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>大型箱</td>
                <td className={styles.number}>{fmt(event.cargo.big)}</td>
              </tr>
              <tr>
                <td>普通箱</td>
                <td className={styles.number}>{fmt(event.cargo.normal)}</td>
              </tr>
              <tr>
                <td>危险品箱</td>
                <td className={styles.number}>{fmt(event.cargo.danger)}</td>
              </tr>
              <tr>
                <td>
                  <strong>合计在船</strong>
                </td>
                <td className={styles.number}>
                  <strong>{fmt(event.cargo.onboard)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.section}>
        <h4 className={`${styles.sectionTitle} ${styles.sectionTitleContainer}`}>货箱明细</h4>
        {loadingRows && <div className={styles.stateText}>正在加载货箱数据…</div>}
        {!loadingRows && rowsError && (
          <div className={styles.stateText}>货箱数据加载失败：{rowsError}</div>
        )}
        {!loadingRows && !rowsError && filteredRows.length > 0 && (
          <div className={styles.searchBarRow}>
            <input
              className={styles.searchInput}
              onChange={changeEvent => setSearchKeyword(changeEvent.target.value)}
              placeholder='搜索任意字段（箱号/航次/码头/状态等）'
              type='text'
              value={searchKeyword}
            />
            <span className={styles.searchCount}>
              显示 {searchedRows.length} / {filteredRows.length}
            </span>
          </div>
        )}
        {!loadingRows && !rowsError && filteredRows.length === 0 && (
          <div className={styles.stateText}>当前驳船在该港口暂无匹配货箱记录</div>
        )}
        {!loadingRows && !rowsError && filteredRows.length > 0 && searchedRows.length === 0 && (
          <div className={styles.stateText}>未找到匹配“{searchKeyword}”的记录</div>
        )}
        {!loadingRows && !rowsError && searchedRows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>箱号</th>
                  <th>
                    <button
                      className={styles.sortBtn}
                      onClick={() => handleSortTimeField('实际离港时间')}
                      type='button'
                    >
                      实际离港时间{' '}
                      <span className={styles.sortMark}>{renderSortMark('实际离港时间')}</span>
                    </button>
                  </th>
                  <th style={{ textAlign: 'center' }}>L/F/E</th>
                  <th style={{ textAlign: 'center' }}>危类</th>
                  <th>箱主</th>
                  <th style={{ textAlign: 'center' }}>内外贸（D/F）</th>
                  <th>起运港码头</th>
                  <th>目的港码头</th>
                  <th>干线船名</th>
                  <th>干线航次</th>
                  <th>干线码头</th>
                  <th style={{ textAlign: 'right' }}>重量</th>
                  <th style={{ textAlign: 'right' }}>TEU</th>
                  <th>
                    <button
                      className={styles.sortBtn}
                      onClick={() => handleSortTimeField('ETD')}
                      type='button'
                    >
                      ETD <span className={styles.sortMark}>{renderSortMark('ETD')}</span>
                    </button>
                  </th>
                  <th>
                    <button
                      className={styles.sortBtn}
                      onClick={() => handleSortTimeField('箱就绪时间')}
                      type='button'
                    >
                      箱就绪时间{' '}
                      <span className={styles.sortMark}>{renderSortMark('箱就绪时间')}</span>
                    </button>
                  </th>
                  <th style={{ textAlign: 'center' }}>是否中转</th>
                  <th>route</th>
                  <th style={{ textAlign: 'center' }}>current_leg</th>
                  <th>location</th>
                  <th style={{ textAlign: 'center' }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.slice(0, 120).map(row => (
                  <tr key={`${row.箱号}-${row.ETD}`}>
                    <td className={styles.mono}>{row.箱号 || '-'}</td>
                    <td>{row.实际离港时间 || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${styles.badge} ${styles.badgeType}`}>
                        {row['L/F/E'] || '-'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.危类 || '-'}</td>
                    <td>{row.箱主 || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{row['内外贸（D/F）'] || '-'}</td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.起运港码头)}>
                        {row.起运港码头 || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.目的港码头)}>
                        {row.目的港码头 || '-'}
                      </span>
                    </td>
                    <td>{row.干线船名 || '-'}</td>
                    <td>{row.干线航次 || '-'}</td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.干线码头)}>
                        {row.干线码头 || '-'}
                      </span>
                    </td>
                    <td className={styles.number}>{fmtNum(row.重量)}</td>
                    <td className={styles.number}>{fmtNum(row.TEU)}</td>
                    <td>{row.ETD || '-'}</td>
                    <td>{row.箱就绪时间 || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{row.是否中转 || '-'}</td>
                    <td>
                      <div className={styles.routePath}>
                        {(() => {
                          const routePorts = parseRoutePath(row.route)

                          if (routePorts.length === 0) {
                            return '-'
                          }

                          return routePorts.map((port, index, array) => (
                            <div
                              className={styles.routeNodeWrap}
                              key={`${row.箱号}-route-${index}`}
                            >
                              <span className={styles.routeNode} style={getPortTagStyle(port)}>
                                {port}
                              </span>
                              {index < array.length - 1 && (
                                <svg
                                  className={styles.routeIcon}
                                  viewBox='0 0 16 16'
                                  aria-hidden='true'
                                >
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
                          ))
                        })()}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.current_leg || '-'}</td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.location)}>
                        {row.location || '-'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`${styles.badge} ${
                          row.status === 'finish' ? styles.badgeDone : styles.badgePending
                        }`}
                      >
                        {row.status || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedRows.length > 120 && (
              <div className={styles.stateText}>仅展示前 120 条，当前共 {sortedRows.length} 条</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
