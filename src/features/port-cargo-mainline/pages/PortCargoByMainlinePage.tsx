import { useTheme } from '@/shared/theme'
import { useElementWidth } from '@/shared/lib/useContainerSize'
import { ScreenPage } from '@/shared/components/ScreenPage'
import chrome from '@/shared/components/ScreenPage/ScreenPage.module.css'
import { PortCargoByMainlineView } from '../components/PortCargoByMainlineView'
import styles from './PortCargoByMainlinePage.module.css'

export default function PortCargoByMainlinePage() {
  const { theme } = useTheme()
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const metrics = [
    { label: '模式', value: 'Origin' },
    { label: '图层', value: 'Cargo' },
    { label: '主题', value: theme === 'dark' ? 'Dark' : 'Light' }
  ]

  return (
    <ScreenPage
      eyebrow='Cargo Flow'
      title='港口主线货流视图'
      description='从港口维度查看主线货箱分布与箱型构成。'
      metrics={metrics}
    >
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
    </ScreenPage>
  )
}
