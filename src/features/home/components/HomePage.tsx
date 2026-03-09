import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BargeCargoGanttView, CargoTablePanel, type GanttEvent } from '@/features/barge-cargo-gantt'
import { PortCargoByMainlineView } from '@/features/port-cargo-mainline'
import { PortLocationMap } from '@/features/port-location-map'
import styles from './HomePage.module.css'

type MetricItem = {
  label: string
  value: string
  description: string
}

type ShortcutItem = {
  title: string
  to: string
}

type ResponsivePanelProps = {
  title: string
  description: string
  action?: ReactNode
  children: (width: number) => ReactNode
}

const metrics: MetricItem[] = [
  {
    label: '联动视图',
    value: '3 个',
    description: '甘特图、货物流向与地图在一个面板内统一展示。'
  },
  {
    label: '分析焦点',
    value: '港口级',
    description: '点击港口后同步查看时间、空间与货量分布变化。'
  },
  {
    label: '布局策略',
    value: '响应式',
    description: '桌面端双列编排，窄屏自动折叠为纵向浏览。'
  }
]

const shortcuts: ShortcutItem[] = [
  { title: '查看甘特图全屏页', to: '/barge-cargo-gantt' },
  { title: '查看货流全屏页', to: '/port-cargo-mainline' },
  { title: '查看地图全屏页', to: '/port-location-map' }
]

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width)
    }

    updateWidth()

    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width
      setWidth(nextWidth)
    })

    observer.observe(element)
    window.addEventListener('resize', updateWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  return { ref, width }
}

function ResponsivePanel({ title, description, action, children }: ResponsivePanelProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>()

  return (
    <section className={styles.panelCard}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          <p className={styles.panelDescription}>{description}</p>
        </div>
        {action ? <div className={styles.panelAction}>{action}</div> : null}
      </div>

      <div ref={ref} className={styles.panelBody}>
        {width > 0 ? children(width) : null}
      </div>
    </section>
  )
}

export default function HomePage() {
  const [activePort, setActivePort] = useState<string | undefined>()
  const [selectedEvent, setSelectedEvent] = useState<GanttEvent | null>(null)

  const handlePortSelection = useCallback((portCode: string) => {
    setSelectedEvent(null)
    setActivePort(current => (current === portCode ? undefined : portCode))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedEvent(null)
    setActivePort(undefined)
  }, [])

  const handleGanttSelection = useCallback((event: GanttEvent) => {
    setSelectedEvent(event)
    setActivePort(event.port || undefined)
  }, [])

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Barge Scheduling Dashboard</p>
          <h1 className={styles.title}>驳船调度综合看板</h1>
          <p className={styles.description}>
            将甘特图、货物分布和地图视图整合到同一个分析面板中，用统一的港口联动上下文串起调度时序、货物流向与空间位置。
          </p>

          <div className={styles.toolbar}>
            <div className={styles.selectionBadge}>
              <span className={styles.selectionLabel}>当前联动港口</span>
              <strong>{activePort ?? '全部港口'}</strong>
            </div>

            <div className={styles.toolbarActions}>
              <button type='button' className={styles.primaryButton} onClick={clearSelection}>
                清空联动
              </button>

              {shortcuts.map(item => (
                <Link key={item.to} to={item.to} className={styles.secondaryLink}>
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {metrics.map(item => (
            <article key={item.label} className={styles.metricCard}>
              <p className={styles.metricLabel}>{item.label}</p>
              <p className={styles.metricValue}>{item.value}</p>
              <p className={styles.metricDescription}>{item.description}</p>
            </article>
          ))}
        </div>
      </header>

      <section className={styles.overviewGrid}>
        <ResponsivePanel
          title='货物视图'
          description='按港口聚合主线货流，点击任一港口行即可同步联动甘特图和地图。'
          action={
            activePort ? <span className={styles.inlineStatus}>已聚焦 {activePort}</span> : null
          }
        >
          {width => (
            <div className={styles.chartViewport}>
              <PortCargoByMainlineView
                width={Math.max(width, 640)}
                height={520}
                selectedPort={activePort}
                onBarClick={portId => handlePortSelection(portId)}
              />
            </div>
          )}
        </ResponsivePanel>

        <section className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>地图视图</h2>
              <p className={styles.panelDescription}>
                查看港口空间分布，并通过地图交互反向驱动时序与货流分析。
              </p>
            </div>
            {activePort ? <span className={styles.inlineStatus}>定位到 {activePort}</span> : null}
          </div>

          <div className={styles.panelBody}>
            <PortLocationMap
              compact
              selectedPortCode={activePort}
              onPortSelect={handlePortSelection}
            />
          </div>
        </section>
      </section>

      <section className={styles.timelineGrid}>
        <ResponsivePanel
          title='甘特图视图'
          description='展示驳船靠港、装卸、等待与航行时序。点击条块后在右侧查看对应货箱明细。'
          action={
            activePort ? <span className={styles.inlineStatus}>高亮港口 {activePort}</span> : null
          }
        >
          {width => (
            <div className={styles.chartViewportWide}>
              <BargeCargoGanttView
                width={Math.max(width, 1120)}
                height={760}
                highlightPort={activePort}
                onBarClick={handleGanttSelection}
              />
            </div>
          )}
        </ResponsivePanel>

        <section className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>作业明细</h2>
              <p className={styles.panelDescription}>
                根据甘特图选中的作业区块，查看对应的货箱记录、主线口岸和时间字段。
              </p>
            </div>
          </div>

          <div className={styles.detailPanel}>
            {selectedEvent ? (
              <div className={styles.detailSummary}>
                <span className={styles.detailTag}>{selectedEvent.port}</span>
                <span className={styles.detailTag}>{selectedEvent.vessel}</span>
                <span className={styles.detailTag}>{selectedEvent.voyage}</span>
              </div>
            ) : (
              <div className={styles.emptyState}>
                先点击左侧甘特图中的港口停靠或作业块，再在此查看明细数据。
              </div>
            )}

            <CargoTablePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        </section>
      </section>
    </section>
  )
}
