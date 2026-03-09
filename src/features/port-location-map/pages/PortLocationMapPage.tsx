import { PortLocationMap } from '../components/PortLocationMap'
import styles from './PortLocationMapPage.module.css'

export default function PortLocationMapPage() {
  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Feature Demo</p>
          <h1 className={styles.title}>港口地理分布视图</h1>
          <p className={styles.description}>
            基于 `public/data/common/port_locations.json` 绘制港口地图分布，底图渲染方式参考
            MapLibre 矢量地图方案，并随系统浅色 / 深色主题自动切换。
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>港口地理位置</h2>
            <p>默认读取 `public/data/common/port_locations.json`，展示港口编码、名称及坐标位置。</p>
          </div>
        </div>

        <div className={styles.mapWrap}>
          <PortLocationMap />
        </div>
      </section>
    </section>
  )
}
