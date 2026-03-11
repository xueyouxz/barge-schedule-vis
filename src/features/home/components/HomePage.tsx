import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks'
import { toggleSelectedPort, setSelectedPort } from '@/shared/lib/dashboardFilterSlice'
import { DashboardShell } from '@/shared/components/DashboardShell/DashboardShell'
import { SettingsPanel } from '@/shared/components/SettingsPanel/SettingsPanel'
import { GlobalColorLegend } from '@/shared/components/GlobalColorLegend/GlobalColorLegend'
import { WidgetHeader } from '@/shared/components/WidgetHeader/WidgetHeader'
import { APP_NAME } from '@/shared/constants/app.constants'
import { useContainerSize } from '@/shared/lib/useContainerSize'
import { BargeCargoGanttView, type InteractiveEvent } from '@/features/barge-cargo-gantt'
import { PortCargoByMainlineView, CargoDistributionView } from '@/features/port-cargo-mainline'
import { PortLocationMap } from '@/features/port-location-map'
import styles from './HomePage.module.css'

type MeasuredPanelProps = {
  className?: string
  children: (size: { width: number; height: number }) => ReactNode
}

function MeasuredPanel({ className, children }: MeasuredPanelProps) {
  const [ref, size] = useContainerSize<HTMLDivElement>()

  return (
    <div ref={ref} className={className}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}

type CargoViewTab = 'mainline' | 'distribution'

const CARGO_TABS: { id: CargoViewTab; label: string }[] = [
  { id: 'mainline', label: '干线分布' },
  { id: 'distribution', label: '力导向分布' }
]

export default function HomePage() {
  const dispatch = useAppDispatch()
  const activePort = useAppSelector(state => state.dashboardFilter.selectedPort) ?? undefined
  const [cargoTab, setCargoTab] = useState<CargoViewTab>('mainline')

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
          <GlobalColorLegend />
        </header>

        <section className={styles.dashboardGrid}>
          <section className={[styles.panelCard, styles.settingsPanel].join(' ')}>
            <WidgetHeader title='场景设置' />
            <div className={styles.settingsPanelBody}>
              <SettingsPanel showHeading={false} />
            </div>
          </section>

          <section className={[styles.panelCard, styles.cargoPanel].join(' ')}>
            <WidgetHeader
              title='箱量分布视图'
              actions={
                <div className={styles.cargoTabs}>
                  {CARGO_TABS.map(tab => (
                    <button
                      key={tab.id}
                      className={[
                        styles.cargoTabBtn,
                        cargoTab === tab.id ? styles.cargoTabBtnActive : ''
                      ].join(' ')}
                      onClick={() => setCargoTab(tab.id)}
                      type='button'
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              }
            />
            <MeasuredPanel className={styles.panelBody}>
              {size =>
                cargoTab === 'mainline' ? (
                  <PortCargoByMainlineView
                    width={size.width}
                    height={size.height}
                    selectedPort={activePort}
                    dataMode='input'
                    onBarClick={portId => handlePortSelection(portId)}
                  />
                ) : (
                  <CargoDistributionView dataMode='input' />
                )
              }
            </MeasuredPanel>
          </section>

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
                <MeasuredPanel className={styles.ganttInsetBody}>
                  {() => <BargeCargoGanttView onBarClick={handleGanttSelection} />}
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
