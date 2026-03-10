import { useState } from 'react'
import { useTheme } from '@/shared/theme'
import { useElementWidth } from '@/shared/lib/useContainerSize'
import { ScreenPage } from '@/shared/components/ScreenPage'
import chrome from '@/shared/components/ScreenPage/ScreenPage.module.css'
import { BargeCargoGanttView } from '../components/BargeCargoGanttView'
import type { GanttEvent } from '../components/BargeCargoGanttView'
import { CargoTablePanel } from '../components/CargoTablePanel'
import styles from './BargeCargoGanttPage.module.css'

export default function BargeCargoGanttPage() {
  const [selectedEvent, setSelectedEvent] = useState<GanttEvent | null>(null)
  const { mode } = useTheme()
  const { ref, width } = useElementWidth<HTMLDivElement>()

  const selectionLabel = selectedEvent ? selectedEvent.port || selectedEvent.vessel : '未选中'
  const metrics = [
    { label: '模式', value: 'Gantt' },
    { label: '选择', value: selectionLabel },
    { label: '主题', value: mode === 'dark' ? 'Dark' : 'Light' }
  ]

  return (
    <ScreenPage
      eyebrow='Barge Timeline'
      title='驳船货流甘特视图'
      description='聚焦靠泊、作业、等待与航行时序。'
      metrics={metrics}
    >
      <section className={styles.layoutGrid}>
        <section className={`${chrome.panel} ${styles.chartPanel}`}>
          <div className={chrome.panelHeader}>
            <div>
              <span className={chrome.panelEyebrow}>Timeline Stage</span>
              <h2 className={chrome.panelTitle}>驳船时序</h2>
            </div>
            <span className={chrome.panelStatus}>焦点 {selectionLabel}</span>
          </div>

          <div ref={ref} className={chrome.panelBody}>
            <div className={chrome.viewport}>
              {width > 0 ? (
                <BargeCargoGanttView
                  width={Math.max(width, 920)}
                  height={780}
                  onBarClick={setSelectedEvent}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className={`${chrome.panel} ${styles.detailPanel}`}>
          <div className={chrome.panelHeader}>
            <div>
              <span className={chrome.panelEyebrow}>Cargo Detail</span>
              <h2 className={chrome.panelTitle}>作业明细</h2>
            </div>
            <span className={chrome.panelStatus}>{selectedEvent ? '已联动' : '等待选择'}</span>
          </div>

          <div className={styles.detailWrap}>
            <CargoTablePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        </section>
      </section>
    </ScreenPage>
  )
}
