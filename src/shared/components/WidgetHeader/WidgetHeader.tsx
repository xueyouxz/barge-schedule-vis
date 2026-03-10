import type { ReactNode } from 'react'
import styles from './WidgetHeader.module.css'

interface WidgetHeaderProps {
  icon?: ReactNode
  title: string
  extra?: ReactNode
}

export function WidgetHeader({ icon, title, extra }: WidgetHeaderProps) {
  return (
    <div className={styles.header}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.title}>{title}</span>
      {extra ? <span className={styles.extra}>{extra}</span> : null}
    </div>
  )
}
