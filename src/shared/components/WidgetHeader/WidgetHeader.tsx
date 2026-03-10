import styles from './WidgetHeader.module.css'

interface WidgetHeaderProps {
  title: string
}

export function WidgetHeader({ title }: WidgetHeaderProps) {
  return (
    <div className={styles.header}>
      <span className={styles.title}>{title}</span>
    </div>
  )
}
