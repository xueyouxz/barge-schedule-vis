import { useTheme } from '@/shared/theme'
import { useElementWidth } from '@/shared/lib/useContainerSize'
import chrome from '@/shared/components/ScreenPage/ScreenPage.module.css'
import { PortCargoByMainlineView } from '../components/PortCargoByMainlineView'
import styles from './PortCargoByMainlinePage.module.css'

export default function PortCargoByMainlinePage() {
  const { mode } = useTheme()
  const { ref, width } = useElementWidth<HTMLDivElement>()

  return (
    <section className={chrome.page}>
      <header className={chrome.hero}>
        <div className={chrome.heroGrid}>
          <div className={chrome.heroMain}>
            <p className={chrome.eyebrow}>Cargo Flow</p>
            <h1 className={chrome.title}>港口主线货流视图</h1>
            <p className={chrome.description}>从港口维度查看主线货箱分布与箱型构成。</p>
          </div>

          <div className={chrome.metricGrid}>
            <div className={chrome.metricCard}>
              <span className={chrome.metricLabel}>模式</span>
              <strong className={chrome.metricValue}>Origin</strong>
            </div>
            <div className={chrome.metricCard}>
              <span className={chrome.metricLabel}>图层</span>
              <strong className={chrome.metricValue}>Cargo</strong>
            </div>
            <div className={chrome.metricCard}>
              <span className={chrome.metricLabel}>主题</span>
              <strong className={chrome.metricValue}>{mode === 'dark' ? 'Dark' : 'Light'}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className={`${chrome.panel} ${styles.panel}`}>
        <div className={chrome.panelHeader}>
          <div>
            <span className={chrome.panelEyebrow}>Cargo Matrix</span>
            <h2 className={chrome.panelTitle}>港口维度分布</h2>
          </div>
          <span className={chrome.panelStatus}>主线聚合</span>
        </div>

        <div ref={ref} className={chrome.panelBody}>
          <div className={chrome.viewport}>
            {width > 0 ? (
              <PortCargoByMainlineView width={Math.max(width, 980)} height={760} />
            ) : null}
          </div>
        </div>
      </section>
    </section>
  )
}
