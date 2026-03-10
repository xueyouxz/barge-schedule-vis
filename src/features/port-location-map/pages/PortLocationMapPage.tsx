import { useTheme } from '@/shared/theme'
import chrome from '@/shared/components/ScreenPage/ScreenPage.module.css'
import { PortLocationMap } from '../components/PortLocationMap'
import styles from './PortLocationMapPage.module.css'

export default function PortLocationMapPage() {
  const { mode } = useTheme()

  return (
    <section className={chrome.page}>
      <header className={chrome.hero}>
        <div className={chrome.heroGrid}>
          <div className={chrome.heroMain}>
            <p className={chrome.eyebrow}>Map Stage</p>
            <h1 className={chrome.title}>港口地理分布视图</h1>
            <p className={chrome.description}>聚焦港口坐标、空间分布与交互定位。</p>
          </div>

          <div className={chrome.metricGrid}>
            <div className={chrome.metricCard}>
              <span className={chrome.metricLabel}>模式</span>
              <strong className={chrome.metricValue}>Map</strong>
            </div>
            <div className={chrome.metricCard}>
              <span className={chrome.metricLabel}>底图</span>
              <strong className={chrome.metricValue}>GL</strong>
            </div>
            <div className={chrome.metricCard}>
              <span className={chrome.metricLabel}>主题</span>
              <strong className={chrome.metricValue}>{mode === 'dark' ? 'Dark' : 'Light'}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.layoutGrid}>
        <section className={`${chrome.panel} ${styles.mapPanel}`}>
          <div className={chrome.panelHeader}>
            <div>
              <span className={chrome.panelEyebrow}>Geo View</span>
              <h2 className={chrome.panelTitle}>港口地理位置</h2>
            </div>
            <span className={chrome.panelStatus}>港口地图</span>
          </div>

          <div className={`${chrome.panelBody} ${styles.mapWrap}`}>
            <PortLocationMap />
          </div>
        </section>

        <section className={`${chrome.panel} ${styles.sidePanel}`}>
          <div className={chrome.panelHeader}>
            <div>
              <span className={chrome.panelEyebrow}>Overview</span>
              <h2 className={chrome.panelTitle}>地图状态</h2>
            </div>
            <span className={chrome.panelStatus}>在线</span>
          </div>

          <div className={styles.sideCardGrid}>
            <article className={styles.sideCard}>
              <span className={styles.sideLabel}>数据</span>
              <strong className={styles.sideValue}>Ports</strong>
            </article>
            <article className={styles.sideCard}>
              <span className={styles.sideLabel}>交互</span>
              <strong className={styles.sideValue}>Select</strong>
            </article>
            <article className={styles.sideCard}>
              <span className={styles.sideLabel}>主题联动</span>
              <strong className={styles.sideValue}>Auto</strong>
            </article>
          </div>
        </section>
      </section>
    </section>
  )
}
