import type { ReactNode } from 'react'
import styles from './WidgetHeader.module.css'

interface WidgetHeaderProps {
  title: string
  actions?: ReactNode
}

export function WidgetHeader({ title, actions }: WidgetHeaderProps) {
  return (
    <div className={styles.header}>
      <span className={styles.title}>{title}</span>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
