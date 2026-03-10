import type { ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks'
import { toggleSelectedPort, setSelectedPort } from '@/shared/lib/dashboardFilterSlice'
import { DashboardShell } from '@/shared/components/DashboardShell/DashboardShell'
import { WidgetHeader } from '@/shared/components/WidgetHeader/WidgetHeader'
import { APP_NAME } from '@/shared/constants/app.constants'
import { useContainerSize } from '@/shared/lib/useContainerSize'
import { BargeCargoGanttView, type InteractiveEvent } from '@/features/barge-cargo-gantt'
import { PortCargoByMainlineView } from '@/features/port-cargo-mainline'
import { PortLocationMap } from '@/features/port-location-map'
import styles from './HomePage.module.css'

type ViewPanelProps = {
  className?: string
  title: string
  children?: (size: { width: number; height: number }) => ReactNode
  renderStatic?: () => ReactNode
}

type MeasuredPanelProps = {
  className?: string
  children: (size: { width: number; height: number }) => ReactNode
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

function MeasuredPanel({ className, children }: MeasuredPanelProps) {
  const [ref, size] = useContainerSize<HTMLDivElement>()

  return (
    <div ref={ref} className={className}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}

export default function HomePage() {
  const dispatch = useAppDispatch()
  const activePort = useAppSelector(state => state.dashboardFilter.selectedPort) ?? undefined

  const handlePortSelection = (portCode: string) => {
    dispatch(toggleSelectedPort(portCode))
  }

  const handleGanttSelection = (event: InteractiveEvent) => {
    dispatch(setSelectedPort(event.port || null))
  }

  return (
    <DashboardShell>
      <section className={styles.page}>
        <header className={styles.pageTitleBar}>
          <h1 className={styles.pageTitle}>{APP_NAME}</h1>
        </header>

        <section className={styles.dashboardGrid}>
          <ViewPanel className={styles.cargoPanel} title='箱量分布视图'>
            {size => (
              <PortCargoByMainlineView
                width={size.width}
                height={size.height}
                selectedPort={activePort}
                onBarClick={portId => handlePortSelection(portId)}
              />
            )}
          </ViewPanel>

          <section className={[styles.panelCard, styles.mapPanel].join(' ')}>
            <WidgetHeader title='港口地理位置' />
            <div className={styles.mapPanelBody}>
              <PortLocationMap
                compact
                fillContainer
                selectedPortCode={activePort}
                onPortSelect={handlePortSelection}
              />

              <section className={styles.ganttInset}>
                <WidgetHeader title='驳船作业时序甘特' />
                <MeasuredPanel className={styles.ganttInsetBody}>
                  {size => (
                    <BargeCargoGanttView
                      width={size.width}
                      height={size.height}
                      onBarClick={handleGanttSelection}
                    />
                  )}
                </MeasuredPanel>
              </section>
            </div>
          </section>

          <section className={[styles.panelCard, styles.placeholderPanel].join(' ')} />
        </section>
      </section>
    </DashboardShell>
  )
}
