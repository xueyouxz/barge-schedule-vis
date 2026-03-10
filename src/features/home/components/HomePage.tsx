import { useMemo, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks'
import { toggleSelectedPort, setSelectedPort } from '@/shared/lib/dashboardFilterSlice'
import { DashboardShell } from '@/shared/components/DashboardShell'
import { WidgetHeader } from '@/shared/components/WidgetHeader'
import { useContainerSize } from '@/shared/lib/useContainerSize'
import { BargeCargoGanttView, type GanttEvent } from '@/features/barge-cargo-gantt'
import { PortCargoByMainlineView } from '@/features/port-cargo-mainline'
import { PortLocationMap } from '@/features/port-location-map'
import styles from './HomePage.module.css'

function ShipIcon() {
  return <span aria-hidden='true'>航</span>
}

function GridIcon() {
  return <span aria-hidden='true'>流</span>
}

function MapIcon() {
  return <span aria-hidden='true'>港</span>
}

type ViewPanelProps = {
  className?: string
  title: string
  extra?: string
  icon: ReactNode
  children: (size: { width: number; height: number }) => ReactNode
}

function ViewPanel({ className, title, extra, icon, children }: ViewPanelProps) {
  const [ref, size] = useContainerSize<HTMLDivElement>()

  return (
    <section className={[styles.panelCard, className].filter(Boolean).join(' ')}>
      <WidgetHeader icon={icon} title={title} extra={extra} />
      <div ref={ref} className={styles.panelBody}>
        {size.width > 0 && size.height > 0 ? children(size) : null}
      </div>
    </section>
  )
}

export default function HomePage() {
  const dispatch = useAppDispatch()
  const activePort = useAppSelector(state => state.dashboardFilter.selectedPort) ?? undefined

  const nowLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return formatter.format(new Date())
  }, [])

  const kpis = [
    {
      label: '设计基准',
      value: '1920×1080'
    },
    {
      label: '联动状态',
      value: activePort ?? '全港口'
    },
    {
      label: '视图数量',
      value: '3'
    }
  ]

  const handlePortSelection = (portCode: string) => {
    dispatch(toggleSelectedPort(portCode))
  }

  const handleGanttSelection = (event: GanttEvent) => {
    dispatch(setSelectedPort(event.port || null))
  }

  return (
    <DashboardShell>
      <section className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.eyebrow}>Barge Dashboard</p>
            <h1 className={styles.title}>驳船作业与港口联动大屏</h1>
            <p className={styles.description}>
              聚合作业甘特、主线港口货量与地理分布，首页联动以港口为中心组织三张核心视图。
            </p>
          </div>

          <div className={styles.metricGrid}>
            {kpis.map(item => (
              <article key={item.label} className={styles.metricCard}>
                <span className={styles.metricLabel}>{item.label}</span>
                <strong className={styles.metricValue}>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className={styles.heroMeta}>
            <span className={styles.metaPill}>首页大屏</span>
            <span className={styles.metaText}>更新时间 {nowLabel}</span>
          </div>
        </header>

        <section className={styles.dashboardGrid}>
          <ViewPanel
            className={styles.cargoPanel}
            title='主线港口箱量分布'
            extra={activePort ? `高亮 ${activePort}` : '点击联动'}
            icon={<GridIcon />}
          >
            {size => (
              <PortCargoByMainlineView
                width={size.width}
                height={size.height}
                selectedPort={activePort}
                onBarClick={portId => handlePortSelection(portId)}
              />
            )}
          </ViewPanel>

          <section className={`${styles.panelCard} ${styles.mapPanel}`}>
            <WidgetHeader
              icon={<MapIcon />}
              title='港口地理位置'
              extra={activePort ? `选中 ${activePort}` : '地图联动'}
            />
            <div className={styles.panelBody}>
              <PortLocationMap
                compact
                selectedPortCode={activePort}
                onPortSelect={handlePortSelection}
              />
            </div>
          </section>

          <ViewPanel
            className={styles.ganttPanel}
            title='驳船作业时序甘特'
            extra={activePort ? `聚焦 ${activePort}` : '全量视图'}
            icon={<ShipIcon />}
          >
            {size => (
              <BargeCargoGanttView
                width={size.width}
                height={size.height}
                highlightPort={activePort}
                onBarClick={handleGanttSelection}
              />
            )}
          </ViewPanel>
        </section>
      </section>
    </DashboardShell>
  )
}
