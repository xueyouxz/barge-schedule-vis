import { PortCargoByMainlineView } from '../components/PortCargoByMainlineView'
import styles from './PortCargoByMainlinePage.module.css'

export default function PortCargoByMainlinePage() {
  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Feature Demo</p>
          <h1 className={styles.title}>港口主线货流视图</h1>
          <p className={styles.description}>
            按起运港聚合货箱，并按主线路径拆分展示货流分布。每个块体的宽度表示箱量规模，内部离散小格表示重箱与空箱构成。
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>港口维度分布</h2>
            <p>默认读取 `public/data/output/2026-01-13 17-20-38/container_records.csv`。</p>
          </div>
        </div>

        <div className={styles.chartWrap}>
          <PortCargoByMainlineView width={1480} height={760} />
        </div>
      </section>
    </section>
  )
}
