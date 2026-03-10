import { useMemo } from 'react'
import { buildPortColorMap } from '@/shared/lib/portColors'
import { usePortLocations } from '@/shared/hooks/usePortLocations'
import { useTheme } from '@/shared/theme'
import styles from './GlobalColorLegend.module.css'

export function GlobalColorLegend() {
  const {
    theme,
    tokens: { chart }
  } = useTheme()
  const { data: ports } = usePortLocations()

  const portEntries = useMemo(() => {
    const colorMap = buildPortColorMap(
      ports.map(port => port.code),
      theme
    )

    return ports.map(port => ({
      code: port.code,
      label: `${port.code}`,
      title: `${port.code} ${port.name}`,
      color: colorMap.get(port.code) ?? chart.portBandFallback
    }))
  }, [chart.portBandFallback, ports, theme])

  const cargoEntries = useMemo(
    () => [
      { label: '重箱', color: chart.cargoNormal },
      { label: '空箱', color: chart.sail }
    ],
    [chart.cargoNormal, chart.sail]
  )

  return (
    <div className={styles.legend} aria-label='全局颜色图例'>
      <div className={styles.section}>
        <span className={styles.label}>港口</span>
        <div className={styles.list}>
          {portEntries.map(entry => (
            <span key={entry.code} className={styles.chip} title={entry.title}>
              <span className={styles.swatch} style={{ background: entry.color }} />
              <span className={styles.chipText}>{entry.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>货箱</span>
        <div className={styles.list}>
          {cargoEntries.map(entry => (
            <span key={entry.label} className={styles.chip}>
              <span
                className={`${styles.swatch} ${styles.cargoSwatch}`.trim()}
                style={{ background: entry.color }}
              />
              <span className={styles.chipText}>{entry.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
