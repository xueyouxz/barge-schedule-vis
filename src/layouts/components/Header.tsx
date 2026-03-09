import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div>
          <p className={styles.kicker}>调度分析平台</p>
          <p className={styles.brand}>驳船调度可视化分析系统</p>
        </div>
      </div>
    </header>
  )
}
