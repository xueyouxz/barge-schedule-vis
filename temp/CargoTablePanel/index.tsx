import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import type { BarClickData } from '@/types'
import { resolvePortColor } from '@/constants/colorMapping'
import { registerPortIds } from '@/store/colorMappingSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import styles from './style/index.module.css'

export interface CargoTablePanelProps {
  /** 当前选中的 bar 数据，为 null 时显示空状态 */
  data: BarClickData | null
  /** 货箱明细 CSV 路径 */
  containerRecordsPath?: string
  /** 关闭面板 */
  onClose?: () => void
}

type ContainerRecordRow = {
  箱号: string
  船名: string
  航次: string
  实际离港时间: string
  ['进出口（I/O）']: string
  ['L/F/E']: string
  危类: string
  箱主: string
  ['内外贸（D/F）']: string
  重量: string
  TEU: string
  起运港码头: string
  目的港码头: string
  干线船名: string
  干线航次: string
  干线码头: string
  ETD: string
  箱就绪时间: string
  是否中转: string
  route: string
  current_leg: string
  status: string
  location: string
}

type TimeSortField = '实际离港时间' | 'ETD' | '箱就绪时间'
type SortOrder = 'asc' | 'desc'

const DEFAULT_CONTAINER_RECORDS_PATH = '/data/output/2026-01-13 17-20-38/container_records.csv'

/** 格式化数值：保留 1 位小数，去掉多余的 .0 */
function fmt(v: number | undefined): string {
  if (v === undefined || v === null) return '-'
  const s = v.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

function fmtNum(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '-'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return fmt(num)
}

function splitBargeId(bargeId: string): { vessel: string; voyage: string } {
  const idx = bargeId.lastIndexOf('-')
  if (idx <= 0) return { vessel: bargeId, voyage: '' }
  return {
    vessel: bargeId.slice(0, idx),
    voyage: bargeId.slice(idx + 1),
  }
}

function withAlpha(hexColor: string, alpha = 0.25): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#')) return hexColor
  const hex = normalized.slice(1)
  const isShort = hex.length === 3
  const isLong = hex.length === 6
  if (!isShort && !isLong) return hexColor

  const full = isShort
    ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : hex
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getReadableTextColor(hexColor: string): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#')) return '#2a2520'
  const hex = normalized.slice(1)
  const isShort = hex.length === 3
  const isLong = hex.length === 6
  if (!isShort && !isLong) return '#2a2520'

  const full = isShort
    ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : hex
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#2a2520' : '#ffffff'
}

export default function CargoTablePanel({ data, containerRecordsPath, onClose }: CargoTablePanelProps) {
  const dispatch = useAppDispatch()
  const portColorMap = useAppSelector((state) => state.colorMapping.portColors)
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
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        const parsed = d3.csvParse(text) as unknown as ContainerRecordRow[]
        if (active) setRows(parsed)
      } catch (err) {
        if (active) {
          setRows([])
          setRowsError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (active) setLoadingRows(false)
      }
    }

    loadRows()
    return () => {
      active = false
    }
  }, [containerRecordsPath])

  const filteredRows = useMemo(() => {
    if (!data) return []
    const { bargeId, portId } = data
    const { vessel, voyage } = splitBargeId(bargeId)

    const isPortMatched = (r: ContainerRecordRow) =>
      r.起运港码头 === portId || r.目的港码头 === portId || r.location === portId

    // bargeId 为空时仅按港口过滤（起运港码头分布视图点击场景）
    if (!bargeId) {
      return rows.filter(isPortMatched)
    }

    return rows.filter((r) => r.船名 === vessel && r.航次 === voyage && isPortMatched(r))
  }, [rows, data])

  const stats = useMemo(() => {
    const total = filteredRows.length
    const exportCount = filteredRows.filter((r) => r['进出口（I/O）'] === 'O').length
    const importCount = filteredRows.filter((r) => r['进出口（I/O）'] === 'I').length
    const finishCount = filteredRows.filter((r) => r.status === 'finish').length
    return {
      total,
      exportCount,
      importCount,
      finishRate: total > 0 ? `${Math.round((finishCount / total) * 100)}%` : '-',
    }
  }, [filteredRows])

  const searchedRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (!keyword) return filteredRows
    return filteredRows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(keyword)),
    )
  }, [filteredRows, searchKeyword])

  const parseDateTime = (value: string | undefined): number => {
    if (!value) return Number.NaN
    const m = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
    if (!m) return Number.NaN
    const [, y, mo, d, h, mi, s] = m
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime()
  }

  const sortedRows = useMemo(() => {
    const copied = [...searchedRows]
    copied.sort((a, b) => {
      const at = parseDateTime(a[timeSortField])
      const bt = parseDateTime(b[timeSortField])
      const aInvalid = Number.isNaN(at)
      const bInvalid = Number.isNaN(bt)

      if (aInvalid && bInvalid) return 0
      if (aInvalid) return 1
      if (bInvalid) return -1

      return sortOrder === 'asc' ? at - bt : bt - at
    })
    return copied
  }, [searchedRows, timeSortField, sortOrder])

  const handleSortTimeField = (field: TimeSortField) => {
    if (timeSortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setTimeSortField(field)
    setSortOrder('asc')
  }

  const renderSortMark = (field: TimeSortField): string => {
    if (timeSortField !== field) return '↕'
    return sortOrder === 'asc' ? '▲' : '▼'
  }

  const parseRoutePath = (routeRaw: string): string[] => {
    if (!routeRaw) return []
    const matches = routeRaw.match(/'([^']+)'/g)
    if (!matches) return []
    const ports = matches
      .map((s) => s.replace(/'/g, ''))
      .filter((v, idx, arr) => v && (idx === 0 || v !== arr[idx - 1]))
    return ports
  }

  useEffect(() => {
    if (!data) return

    const portSet = new Set<string>()
    if (data.portId) portSet.add(data.portId)

    rows.forEach((row) => {
      if (row.起运港码头) portSet.add(row.起运港码头)
      if (row.目的港码头) portSet.add(row.目的港码头)
      if (row.干线码头) portSet.add(row.干线码头)
      if (row.location) portSet.add(row.location)
      parseRoutePath(row.route).forEach((port) => portSet.add(port))
    })

    if (portSet.size > 0) {
      dispatch(registerPortIds(Array.from(portSet)))
    }
  }, [data, rows, dispatch])

  const getPortTagStyle = (portId?: string) => {
    const text = (portId || '').trim()
    if (!text) return undefined
    const color = resolvePortColor(text, portColorMap)
    return {
      backgroundColor: withAlpha(color, 0.28),
      borderColor: withAlpha(color, 0.65),
      color: getReadableTextColor(color),
    }
  }

  if (!data) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📦</span>
          <span>点击左侧视图中的装卸货条形以查看货物详情</span>
        </div>
      </div>
    )
  }

  const { portId, barLayout, exportLoad, unloadData, contSummary } = data

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>
          ⚓
          <span className={styles.portTag} style={getPortTagStyle(portId)}>{portId || '-'}</span>
        </h3>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose} title="关闭">
            ×
          </button>
        )}
      </div>

      <div className={styles.summaryText}>货箱数：{stats.total}，出口：{stats.exportCount}，进口：{stats.importCount}，完成率：{stats.finishRate}</div>

      {/* ——— 装货明细 ——— */}
      {(exportLoad || barLayout.exportTeu > 0) && (
        <div className={styles.section}>
          <h4 className={`${styles.sectionTitle} ${styles.sectionTitleLoad}`}>装货明细</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>指标</th>
                <th style={{ textAlign: 'right' }}>数值</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>装货 TEU</td>
                <td className={styles.number}>{fmt(exportLoad?.teu ?? barLayout.exportTeu)}</td>
              </tr>
              {exportLoad?.weight !== undefined && (
                <tr>
                  <td>重量 (t)</td>
                  <td className={styles.number}>{fmt(exportLoad.weight)}</td>
                </tr>
              )}
              {exportLoad && (
                <>
                  <tr>
                    <td>重箱 TEU</td>
                    <td className={styles.number}>{fmt(exportLoad.fullTeu)}</td>
                  </tr>
                  <tr>
                    <td>空箱 TEU</td>
                    <td className={styles.number}>{fmt(exportLoad.emptyTeu)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ——— 卸货明细 ——— */}
      {(unloadData || barLayout.unloadTeu > 0) && (
        <div className={styles.section}>
          <h4 className={`${styles.sectionTitle} ${styles.sectionTitleUnload}`}>卸货明细</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>指标</th>
                <th style={{ textAlign: 'right' }}>数值</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>卸货 TEU</td>
                <td className={styles.number}>{fmt(barLayout.unloadTeu)}</td>
              </tr>
              {unloadData?.numUnload !== undefined && (
                <tr>
                  <td>直接卸货量</td>
                  <td className={styles.number}>{fmt(unloadData.numUnload)}</td>
                </tr>
              )}
              {unloadData?.numTransship !== undefined && unloadData.numTransship > 0 && (
                <tr>
                  <td>转运量</td>
                  <td className={styles.number}>{fmt(unloadData.numTransship)}</td>
                </tr>
              )}
              {unloadData?.costTransship !== undefined && unloadData.costTransship > 0 && (
                <tr>
                  <td>转运成本</td>
                  <td className={styles.number}>{fmt(unloadData.costTransship)}</td>
                </tr>
              )}
              {unloadData?.numTransport !== undefined && unloadData.numTransport > 0 && (
                <tr>
                  <td>运输量</td>
                  <td className={styles.number}>{fmt(unloadData.numTransport)}</td>
                </tr>
              )}
              {unloadData?.costTransport !== undefined && unloadData.costTransport > 0 && (
                <tr>
                  <td>运输成本</td>
                  <td className={styles.number}>{fmt(unloadData.costTransport)}</td>
                </tr>
              )}
              {unloadData?.numLeftOnBoard !== undefined && (
                <tr>
                  <td>卸后留船量</td>
                  <td className={styles.number}>{fmt(unloadData.numLeftOnBoard)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ——— 船上货物状态（来自 cont_summary） ——— */}
      {contSummary && (
        <div className={styles.section}>
          <h4 className={`${styles.sectionTitle} ${styles.sectionTitleOnboard}`}>船上货物状态</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>类型</th>
                <th style={{ textAlign: 'right' }}>装货</th>
                <th style={{ textAlign: 'right' }}>卸货</th>
                <th style={{ textAlign: 'right' }}>在船</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>大型箱</td>
                <td className={styles.number}>{fmt(contSummary.load_large)}</td>
                <td className={styles.number}>{fmt(contSummary.unload_large)}</td>
                <td className={styles.number}>{fmt(contSummary.num_large)}</td>
              </tr>
              <tr>
                <td>普通箱</td>
                <td className={styles.number}>{fmt(contSummary.load_regular)}</td>
                <td className={styles.number}>{fmt(contSummary.unload_regular)}</td>
                <td className={styles.number}>{fmt(contSummary.num_regular)}</td>
              </tr>
              <tr>
                <td>危险品箱</td>
                <td className={styles.number}>{fmt(contSummary.load_danger)}</td>
                <td className={styles.number}>{fmt(contSummary.unload_danger)}</td>
                <td className={styles.number}>{fmt(contSummary.num_danger)}</td>
              </tr>
              <tr>
                <td><strong>合计在船</strong></td>
                <td className={styles.number}>-</td>
                <td className={styles.number}>-</td>
                <td className={styles.number}><strong>{fmt(contSummary.num_onboard)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.section}>
        <h4 className={`${styles.sectionTitle} ${styles.sectionTitleContainer}`}>货箱明细</h4>
        {loadingRows && <div className={styles.stateText}>正在加载货箱数据…</div>}
        {!loadingRows && rowsError && <div className={styles.stateText}>货箱数据加载失败：{rowsError}</div>}
        {!loadingRows && !rowsError && filteredRows.length > 0 && (
          <div className={styles.searchBarRow}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索任意字段（箱号/航次/码头/状态等）"
            />
            <span className={styles.searchCount}>显示 {searchedRows.length} / {filteredRows.length}</span>
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
                    <button className={styles.sortBtn} onClick={() => handleSortTimeField('实际离港时间')} type="button">
                      实际离港时间 <span className={styles.sortMark}>{renderSortMark('实际离港时间')}</span>
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
                    <button className={styles.sortBtn} onClick={() => handleSortTimeField('ETD')} type="button">
                      ETD <span className={styles.sortMark}>{renderSortMark('ETD')}</span>
                    </button>
                  </th>
                  <th>
                    <button className={styles.sortBtn} onClick={() => handleSortTimeField('箱就绪时间')} type="button">
                      箱就绪时间 <span className={styles.sortMark}>{renderSortMark('箱就绪时间')}</span>
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
                {sortedRows.slice(0, 120).map((row) => (
                  <tr key={`${row.箱号}-${row.ETD}`}>
                    <td className={styles.mono}>{row.箱号}</td>
                    <td>{row.实际离港时间 || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${styles.badge} ${styles.badgeType}`}>{row['L/F/E'] || '-'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.危类 || '-'}</td>
                    <td>{row.箱主 || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{row['内外贸（D/F）'] || '-'}</td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.起运港码头)}>{row.起运港码头 || '-'}</span>
                    </td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.目的港码头)}>{row.目的港码头 || '-'}</span>
                    </td>
                    <td>{row.干线船名 || '-'}</td>
                    <td>{row.干线航次 || '-'}</td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.干线码头)}>{row.干线码头 || '-'}</span>
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
                          if (routePorts.length === 0) return '-'
                          return routePorts.map((port, idx, arr) => (
                              <div className={styles.routeNodeWrap} key={`${row.箱号}-route-${idx}`}>
                                <span className={styles.routeNode} style={getPortTagStyle(port)}>{port}</span>
                                {idx < arr.length - 1 && (
                                  <svg className={styles.routeIcon} viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M2 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                    <path d="M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            ))
                        })()}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.current_leg || '-'}</td>
                    <td>
                      <span className={styles.portTag} style={getPortTagStyle(row.location)}>{row.location || '-'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${styles.badge} ${row.status === 'finish' ? styles.badgeDone : styles.badgePending}`}>
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
