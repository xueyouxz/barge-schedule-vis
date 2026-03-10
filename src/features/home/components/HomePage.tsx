import type { ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks'
import { toggleSelectedPort, setSelectedPort } from '@/shared/lib/dashboardFilterSlice'
import { DashboardShell } from '@/shared/components/DashboardShell'
import { WidgetHeader } from '@/shared/components/WidgetHeader'
import { useContainerSize } from '@/shared/lib/useContainerSize'
import { BargeCargoGanttView, type GanttEvent } from '@/features/barge-cargo-gantt'
import { useBargeCargoGanttData } from '@/features/barge-cargo-gantt/components/BargeCargoGanttView/hooks/useBargeCargoGanttData'
import { PortCargoByMainlineView } from '@/features/port-cargo-mainline'
import { PortLocationMap } from '@/features/port-location-map'
import styles from './HomePage.module.css'

type ViewPanelProps = {
  className?: string
  title: string
  children?: (size: { width: number; height: number }) => ReactNode
  renderStatic?: () => ReactNode
}

function ViewPanel({ className, title, children, renderStatic }: ViewPanelProps) {
  const [ref, size] = useContainerSize<HTMLDivElement>()
  const content = renderStatic
    ? renderStatic()
    : size.width > 0 && size.height > 0 && children
      ? children(size)
      : null

  return (
    <section className={[styles.panelCard, className].filter(Boolean).join(' ')}>
      <WidgetHeader title={title} />
      <div ref={renderStatic ? undefined : ref} className={styles.panelBody}>
        {content}
      </div>
    </section>
  )
}

export default function HomePage() {
  const dispatch = useAppDispatch()
  const activePort = useAppSelector(state => state.dashboardFilter.selectedPort) ?? undefined
  const { error: ganttError } = useBargeCargoGanttData()

  const handlePortSelection = (portCode: string) => {
    dispatch(toggleSelectedPort(portCode))
  }

  const handleGanttSelection = (event: GanttEvent) => {
    dispatch(setSelectedPort(event.port || null))
  }

  return (
    <DashboardShell>
      <section className={styles.page}>
        <section className={styles.dashboardGrid}>
          <ViewPanel className={styles.cargoPanel} title='主线港口箱量分布'>
            {size => (
              <PortCargoByMainlineView
                width={size.width}
                height={size.height}
                selectedPort={activePort}
                onBarClick={portId => handlePortSelection(portId)}
              />
            )}
          </ViewPanel>

          <ViewPanel
            className={styles.mapPanel}
            title='港口地理位置'
            renderStatic={() => (
              <PortLocationMap
                compact
                fillContainer
                selectedPortCode={activePort}
                onPortSelect={handlePortSelection}
              />
            )}
          />

          <ViewPanel className={styles.ganttPanel} title='驳船作业时序甘特'>
            {size =>
              ganttError ? (
                <div>甘特图数据加载失败：{ganttError}</div>
              ) : (
                <BargeCargoGanttView
                  width={size.width}
                  height={size.height}
                  highlightPort={activePort}
                  onBarClick={handleGanttSelection}
                />
              )
            }
          </ViewPanel>
        </section>
      </section>
    </DashboardShell>
  )
}
