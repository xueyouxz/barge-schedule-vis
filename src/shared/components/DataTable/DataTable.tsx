import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './DataTable.module.css'

type DataTableAlign = 'left' | 'center' | 'right'
type SortOrder = 'asc' | 'desc'
type DataTableComparable = string | number | Date | null | undefined

export interface DataTableColumn<Row> {
  key: string
  header: ReactNode
  accessor?: keyof Row | ((row: Row, rowIndex: number) => ReactNode)
  renderCell?: (row: Row, rowIndex: number) => ReactNode
  align?: DataTableAlign
  headerAlign?: DataTableAlign
  width?: CSSProperties['width']
  minWidth?: CSSProperties['minWidth']
  className?: string
  headerClassName?: string
  sortable?: boolean
  sortAccessor?: (row: Row, rowIndex: number) => DataTableComparable
  sortComparator?: (left: Row, right: Row) => number
  searchable?: boolean
  searchText?: (row: Row, rowIndex: number) => string
}

export interface DataTableProps<Row> {
  columns: Array<DataTableColumn<Row>>
  rows: Row[]
  getRowKey: (row: Row, rowIndex: number) => string
  maxHeight?: CSSProperties['maxHeight']
  stickyHeader?: boolean
  enableSearch?: boolean
  searchPlaceholder?: string
  emptyText?: ReactNode | ((params: { searchKeyword: string; totalRows: number }) => ReactNode)
  enablePagination?: boolean
  defaultPageSize?: number
  pageSizeOptions?: number[]
  defaultSort?: {
    columnKey: string
    order?: SortOrder
  }
  virtualized?: boolean
  rowHeight?: number
  overscan?: number
}

function getAlignClassName(align: DataTableAlign | undefined): string {
  switch (align) {
    case 'center':
      return styles.alignCenter
    case 'right':
      return styles.alignRight
    default:
      return styles.alignLeft
  }
}

function getCellContent<Row>(column: DataTableColumn<Row>, row: Row, rowIndex: number): ReactNode {
  if (column.renderCell) {
    return column.renderCell(row, rowIndex)
  }

  if (typeof column.accessor === 'function') {
    return column.accessor(row, rowIndex)
  }

  if (column.accessor) {
    return row[column.accessor] as ReactNode
  }

  return null
}

function getSearchText<Row>(column: DataTableColumn<Row>, row: Row, rowIndex: number): string {
  if (column.searchText) {
    return column.searchText(row, rowIndex)
  }

  if (typeof column.accessor === 'function') {
    const value = column.accessor(row, rowIndex)
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  if (column.accessor) {
    const value = row[column.accessor]
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  return ''
}

function getSortValue<Row>(
  column: DataTableColumn<Row>,
  row: Row,
  rowIndex: number
): DataTableComparable {
  if (column.sortAccessor) {
    return column.sortAccessor(row, rowIndex)
  }

  if (typeof column.accessor === 'function') {
    const value = column.accessor(row, rowIndex)
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : null
  }

  if (column.accessor) {
    const value = row[column.accessor]
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : null
  }

  return null
}

function compareSortValue(left: DataTableComparable, right: DataTableComparable): number {
  if (left === right) return 0
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1

  const leftValue = left instanceof Date ? left.getTime() : left
  const rightValue = right instanceof Date ? right.getTime() : right

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue
  }

  return String(leftValue).localeCompare(String(rightValue), 'zh-CN', { numeric: true })
}

function buildEmptyText<Row>(
  emptyText: DataTableProps<Row>['emptyText'],
  searchKeyword: string,
  totalRows: number
): ReactNode {
  if (typeof emptyText === 'function') {
    return emptyText({ searchKeyword, totalRows })
  }

  if (emptyText) {
    return emptyText
  }

  return searchKeyword ? `未找到匹配“${searchKeyword}”的记录` : '暂无数据'
}

export default function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  maxHeight,
  stickyHeader = false,
  enableSearch = false,
  searchPlaceholder = '搜索表格内容',
  emptyText,
  enablePagination = false,
  defaultPageSize = 50,
  pageSizeOptions = [20, 50, 100],
  defaultSort,
  virtualized = false,
  rowHeight = 38,
  overscan = 6
}: DataTableProps<Row>) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [sortState, setSortState] = useState<{
    columnKey: string
    order: SortOrder
  } | null>(
    defaultSort ? { columnKey: defaultSort.columnKey, order: defaultSort.order ?? 'asc' } : null
  )
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [page, setPage] = useState(1)
  const [scrollTop, setScrollTop] = useState(0)

  const normalizedPageSizeOptions = useMemo(() => {
    const options = Array.from(new Set([...pageSizeOptions, defaultPageSize])).sort(
      (left, right) => left - right
    )
    return options.filter(option => option > 0)
  }, [defaultPageSize, pageSizeOptions])

  const processedRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    const filtered =
      !enableSearch || !keyword
        ? rows
        : rows.filter((row, rowIndex) =>
            columns.some(column => {
              if (column.searchable === false) return false
              return getSearchText(column, row, rowIndex).toLowerCase().includes(keyword)
            })
          )

    if (!sortState) {
      return filtered
    }

    const targetColumn = columns.find(column => column.key === sortState.columnKey)
    if (!targetColumn?.sortable) {
      return filtered
    }

    return filtered
      .map((row, rowIndex) => ({ row, rowIndex }))
      .sort((left, right) => {
        const compareResult = targetColumn.sortComparator
          ? targetColumn.sortComparator(left.row, right.row)
          : compareSortValue(
              getSortValue(targetColumn, left.row, left.rowIndex),
              getSortValue(targetColumn, right.row, right.rowIndex)
            )

        if (compareResult !== 0) {
          return sortState.order === 'asc' ? compareResult : -compareResult
        }

        return left.rowIndex - right.rowIndex
      })
      .map(item => item.row)
  }, [columns, enableSearch, rows, searchKeyword, sortState])

  const totalRows = processedRows.length
  const totalPages = enablePagination ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1

  useEffect(() => {
    setPage(1)
    setScrollTop(0)
    if (wrapperRef.current) {
      wrapperRef.current.scrollTop = 0
    }
  }, [searchKeyword, sortState, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pageRows = useMemo(() => {
    if (!enablePagination) {
      return processedRows
    }

    const start = (page - 1) * pageSize
    return processedRows.slice(start, start + pageSize)
  }, [enablePagination, page, pageSize, processedRows])

  const canVirtualize = virtualized && typeof maxHeight === 'number' && pageRows.length > 0
  const visibleStartIndex = canVirtualize
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    : 0
  const visibleCount = canVirtualize
    ? Math.ceil((maxHeight as number) / rowHeight) + overscan * 2
    : pageRows.length
  const visibleEndIndex = canVirtualize
    ? Math.min(pageRows.length, visibleStartIndex + visibleCount)
    : pageRows.length
  const visibleRows = canVirtualize ? pageRows.slice(visibleStartIndex, visibleEndIndex) : pageRows
  const topSpacerHeight = canVirtualize ? visibleStartIndex * rowHeight : 0
  const bottomSpacerHeight = canVirtualize ? (pageRows.length - visibleEndIndex) * rowHeight : 0

  const toolbarVisible = enableSearch || enablePagination

  const handleSortToggle = (column: DataTableColumn<Row>) => {
    if (!column.sortable) return

    setSortState(current => {
      if (!current || current.columnKey !== column.key) {
        return { columnKey: column.key, order: 'asc' }
      }

      return {
        columnKey: column.key,
        order: current.order === 'asc' ? 'desc' : 'asc'
      }
    })
  }

  return (
    <div className={styles.root}>
      {toolbarVisible && (
        <div className={styles.toolbar}>
          {enableSearch && (
            <div className={styles.searchArea}>
              <input
                className={styles.searchInput}
                onChange={event => setSearchKeyword(event.target.value)}
                placeholder={searchPlaceholder}
                type='text'
                value={searchKeyword}
              />
              <span className={styles.searchCount}>
                显示 {totalRows} / {rows.length}
              </span>
            </div>
          )}

          {enablePagination && (
            <div className={styles.pageSizeArea}>
              <span className={styles.pageSizeLabel}>每页</span>
              <select
                className={styles.pageSizeSelect}
                onChange={event => setPageSize(Number(event.target.value))}
                value={pageSize}
              >
                {normalizedPageSizeOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div
        ref={wrapperRef}
        className={styles.wrapper}
        style={maxHeight ? { maxHeight } : undefined}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map(column => {
                const headerClassName = [
                  styles.headerCell,
                  getAlignClassName(column.headerAlign ?? column.align),
                  stickyHeader ? styles.stickyHeader : '',
                  column.headerClassName ?? ''
                ]
                  .filter(Boolean)
                  .join(' ')

                const isActiveSortColumn = sortState?.columnKey === column.key
                const sortMark = !column.sortable
                  ? null
                  : isActiveSortColumn
                    ? sortState?.order === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'

                return (
                  <th
                    key={column.key}
                    className={headerClassName}
                    style={{ width: column.width, minWidth: column.minWidth }}
                  >
                    {column.sortable ? (
                      <button
                        className={styles.sortButton}
                        onClick={() => handleSortToggle(column)}
                        type='button'
                      >
                        <span>{column.header}</span>
                        <span className={styles.sortMark}>{sortMark}</span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={columns.length}>
                  {buildEmptyText(emptyText, searchKeyword.trim(), rows.length)}
                </td>
              </tr>
            ) : (
              <>
                {canVirtualize && topSpacerHeight > 0 && (
                  <tr className={styles.spacerRow} aria-hidden='true'>
                    <td colSpan={columns.length} style={{ height: topSpacerHeight }} />
                  </tr>
                )}

                {visibleRows.map((row, rowIndex) => {
                  const absoluteRowIndex = canVirtualize ? visibleStartIndex + rowIndex : rowIndex
                  return (
                    <tr
                      key={getRowKey(row, absoluteRowIndex)}
                      style={canVirtualize ? { height: rowHeight } : undefined}
                    >
                      {columns.map(column => (
                        <td
                          key={column.key}
                          className={[
                            styles.cell,
                            getAlignClassName(column.align),
                            column.className ?? ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {getCellContent(column, row, absoluteRowIndex)}
                        </td>
                      ))}
                    </tr>
                  )
                })}

                {canVirtualize && bottomSpacerHeight > 0 && (
                  <tr className={styles.spacerRow} aria-hidden='true'>
                    <td colSpan={columns.length} style={{ height: bottomSpacerHeight }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && totalRows > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationText}>
            第 {page} / {totalPages} 页，共 {totalRows} 条
          </span>
          <div className={styles.paginationActions}>
            <button
              className={styles.pageButton}
              disabled={page <= 1}
              onClick={() => setPage(1)}
              type='button'
            >
              首页
            </button>
            <button
              className={styles.pageButton}
              disabled={page <= 1}
              onClick={() => setPage(current => Math.max(1, current - 1))}
              type='button'
            >
              上一页
            </button>
            <button
              className={styles.pageButton}
              disabled={page >= totalPages}
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              type='button'
            >
              下一页
            </button>
            <button
              className={styles.pageButton}
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              type='button'
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export type { DataTableAlign, SortOrder }
