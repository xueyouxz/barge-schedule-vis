import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  if (column.searchable === false) {
    return ''
  }

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
  const [sorting, setSorting] = useState<SortingState>(
    defaultSort
      ? [
          {
            id: defaultSort.columnKey,
            desc: (defaultSort.order ?? 'asc') === 'desc'
          }
        ]
      : []
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize
  })

  const normalizedPageSizeOptions = useMemo(() => {
    const options = Array.from(new Set([...pageSizeOptions, defaultPageSize])).sort(
      (left, right) => left - right
    )
    return options.filter(option => option > 0)
  }, [defaultPageSize, pageSizeOptions])

  const tableColumns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    const searchColumn = {
      id: '__search__',
      accessorFn: (row, rowIndex) =>
        columns
          .map(column => getSearchText(column, row, rowIndex).trim())
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      enableSorting: false,
      enableHiding: true
    } satisfies ColumnDef<Row, unknown>

    const visibleColumns = columns.map<ColumnDef<Row, unknown>>(column => ({
      id: column.key,
      accessorFn: (row, rowIndex) => getCellContent(column, row, rowIndex),
      header: () => column.header,
      enableSorting: Boolean(column.sortable),
      enableGlobalFilter: false,
      sortingFn: (left, right) => {
        if (column.sortComparator) {
          return column.sortComparator(left.original, right.original)
        }

        return compareSortValue(
          getSortValue(column, left.original, left.index),
          getSortValue(column, right.original, right.index)
        )
      },
      meta: {
        align: column.align,
        headerAlign: column.headerAlign,
        width: column.width,
        minWidth: column.minWidth,
        className: column.className,
        headerClassName: column.headerClassName
      },
      cell: info => getCellContent(column, info.row.original, info.row.index)
    }))

    return [searchColumn, ...visibleColumns]
  }, [columns])

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter: enableSearch ? searchKeyword.toLowerCase() : '',
      pagination,
      columnVisibility: {
        __search__: false
      }
    },
    onSortingChange: updater => {
      setSorting(updater)
      setPagination(current => ({ ...current, pageIndex: 0 }))
    },
    onGlobalFilterChange: value => {
      setSearchKeyword(String(value))
      setPagination(current => ({ ...current, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
    getRowId: (row, rowIndex) => getRowKey(row, rowIndex),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString'
  })

  useEffect(() => {
    table.setPageSize(defaultPageSize)
  }, [defaultPageSize, table])

  const totalRows = table.getPrePaginationRowModel().rows.length
  const displayedRows = enablePagination
    ? table.getRowModel().rows
    : table.getPrePaginationRowModel().rows
  const totalPages = enablePagination ? Math.max(1, table.getPageCount()) : 1
  const currentPage = enablePagination ? pagination.pageIndex + 1 : 1
  const toolbarVisible = enableSearch || enablePagination

  const canVirtualize = virtualized && typeof maxHeight === 'number' && displayedRows.length > 0
  const rowVirtualizer = useVirtualizer({
    count: displayedRows.length,
    getScrollElement: () => wrapperRef.current,
    estimateSize: () => rowHeight,
    overscan,
    enabled: canVirtualize
  })
  const virtualRows = canVirtualize ? rowVirtualizer.getVirtualItems() : []
  const topSpacerHeight = canVirtualize && virtualRows.length > 0 ? virtualRows[0].start : 0
  const bottomSpacerHeight =
    canVirtualize && virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0
  const rowsToRender = canVirtualize
    ? virtualRows.map(virtualRow => displayedRows[virtualRow.index]).filter(Boolean)
    : displayedRows

  return (
    <div className={styles.root}>
      {toolbarVisible ? (
        <div className={styles.toolbar}>
          {enableSearch ? (
            <div className={styles.searchArea}>
              <input
                className={styles.searchInput}
                onChange={event => table.setGlobalFilter(event.target.value)}
                placeholder={searchPlaceholder}
                type='text'
                value={searchKeyword}
              />
              <span className={styles.searchCount}>
                显示 {totalRows} / {rows.length}
              </span>
            </div>
          ) : null}

          {enablePagination ? (
            <div className={styles.pageSizeArea}>
              <span className={styles.pageSizeLabel}>每页</span>
              <select
                className={styles.pageSizeSelect}
                onChange={event => table.setPageSize(Number(event.target.value))}
                value={pagination.pageSize}
              >
                {normalizedPageSizeOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={wrapperRef}
        className={styles.wrapper}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const meta = header.column.columnDef.meta as
                    | {
                        align?: DataTableAlign
                        headerAlign?: DataTableAlign
                        width?: CSSProperties['width']
                        minWidth?: CSSProperties['minWidth']
                        className?: string
                        headerClassName?: string
                      }
                    | undefined
                  const headerClassName = [
                    styles.headerCell,
                    getAlignClassName(meta?.headerAlign ?? meta?.align),
                    stickyHeader ? styles.stickyHeader : '',
                    meta?.headerClassName ?? ''
                  ]
                    .filter(Boolean)
                    .join(' ')

                  const sortState = header.column.getIsSorted()
                  const sortMark = !header.column.getCanSort()
                    ? null
                    : sortState === 'asc'
                      ? '▲'
                      : sortState === 'desc'
                        ? '▼'
                        : '↕'

                  return (
                    <th
                      key={header.id}
                      className={headerClassName}
                      style={{ width: meta?.width, minWidth: meta?.minWidth }}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className={styles.sortButton}
                          onClick={header.column.getToggleSortingHandler()}
                          type='button'
                        >
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          <span className={styles.sortMark}>{sortMark}</span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={columns.length}>
                  {buildEmptyText(emptyText, searchKeyword.trim(), rows.length)}
                </td>
              </tr>
            ) : (
              <>
                {canVirtualize && topSpacerHeight > 0 ? (
                  <tr className={styles.spacerRow} aria-hidden='true'>
                    <td colSpan={columns.length} style={{ height: topSpacerHeight }} />
                  </tr>
                ) : null}

                {rowsToRender.map((row, renderIndex) => {
                  const absoluteIndex = canVirtualize
                    ? (virtualRows[renderIndex]?.index ?? renderIndex)
                    : renderIndex
                  return (
                    <tr key={row.id} style={canVirtualize ? { height: rowHeight } : undefined}>
                      {row.getVisibleCells().map(cell => {
                        const meta = cell.column.columnDef.meta as
                          | {
                              align?: DataTableAlign
                              className?: string
                            }
                          | undefined

                        return (
                          <td
                            key={`${row.id}-${cell.column.id}-${absoluteIndex}`}
                            className={[
                              styles.cell,
                              getAlignClassName(meta?.align),
                              meta?.className ?? ''
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {canVirtualize && bottomSpacerHeight > 0 ? (
                  <tr className={styles.spacerRow} aria-hidden='true'>
                    <td colSpan={columns.length} style={{ height: bottomSpacerHeight }} />
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && totalRows > 0 ? (
        <div className={styles.pagination}>
          <span className={styles.paginationText}>
            第 {currentPage} / {totalPages} 页，共 {totalRows} 条
          </span>
          <div className={styles.paginationActions}>
            <button
              className={styles.pageButton}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.setPageIndex(0)}
              type='button'
            >
              首页
            </button>
            <button
              className={styles.pageButton}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              type='button'
            >
              上一页
            </button>
            <button
              className={styles.pageButton}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              type='button'
            >
              下一页
            </button>
            <button
              className={styles.pageButton}
              disabled={!table.getCanNextPage()}
              onClick={() => table.setPageIndex(totalPages - 1)}
              type='button'
            >
              末页
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export type { DataTableAlign, SortOrder }
