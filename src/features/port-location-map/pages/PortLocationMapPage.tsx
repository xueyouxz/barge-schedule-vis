import { useTheme } from '@/shared/theme'
import { ScreenPage } from '@/shared/components/ScreenPage'
import chrome from '@/shared/components/ScreenPage/ScreenPage.module.css'
import { PortLocationMap } from '../components/PortLocationMap'
import styles from './PortLocationMapPage.module.css'

export default function PortLocationMapPage() {
  const { theme } = useTheme()
  const metrics = [
    { label: '模式', value: 'Map' },
    { label: '底图', value: 'GL' },
    { label: '主题', value: theme === 'dark' ? 'Dark' : 'Light' }
  ]

  return (
    <ScreenPage
      eyebrow='Map Stage'
      title='港口地理分布视图'
      description='聚焦港口坐标、空间分布与交互定位。'
      metrics={metrics}
    >
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
    </ScreenPage>
  )
}
