import { useState } from 'react'
import { BargeCargoGanttView } from '../components/BargeCargoGanttView'
import type { GanttEvent } from '../components/BargeCargoGanttView'
import { CargoTablePanel } from '../components/CargoTablePanel'
import styles from './BargeCargoGanttPage.module.css'

export default function BargeCargoGanttPage() {
  const [selectedEvent, setSelectedEvent] = useState<GanttEvent | null>(null)

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Feature Demo</p>
          <h1 className={styles.title}>驳船货流甘特视图</h1>
          <p className={styles.description}>
            基于正式主题系统接入的 D3
            甘特视图组件。切换主题后，页面壳层、图表背景、坐标区与弹窗配色都会同步变化。
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>时序视图</h2>
            <p>默认读取 `public/data/output/2026-01-13 17-20-38/` 下的仿真数据。</p>
          </div>
        </div>

        <div className={styles.chartWrap}>
          <BargeCargoGanttView width={1480} onBarClick={setSelectedEvent} />
        </div>

        <div className={styles.detailWrap}>
          <CargoTablePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </div>
      </section>
    </section>
  )
}
