import type { ReactNode } from 'react'
import styles from './ScreenPage.module.css'

type ScreenMetric = {
  label: string
  value: ReactNode
}

interface ScreenPageProps {
  eyebrow: ReactNode
  title: ReactNode
  description: ReactNode
  metrics: ScreenMetric[]
  children: ReactNode
}

export function ScreenPage({ eyebrow, title, description, metrics, children }: ScreenPageProps) {
  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroMain}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>

          <div className={styles.metricGrid}>
            {metrics.map(metric => (
              <div key={metric.label} className={styles.metricCard}>
                <span className={styles.metricLabel}>{metric.label}</span>
                <strong className={styles.metricValue}>{metric.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </header>

      {children}
    </section>
  )
}
