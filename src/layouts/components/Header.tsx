import { NavLink } from 'react-router-dom'
import { useTheme } from '@/shared/theme'
import styles from './Header.module.css'

const navItems = [
  { to: '/', label: '综合看板' },
  { to: '/barge-cargo-gantt', label: '货流甘特视图' },
  { to: '/port-cargo-mainline', label: '港口主线货流' },
  { to: '/port-location-map', label: '港口地理分布' }
]

export function Header() {
  const { mode, toggleTheme } = useTheme()

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <p className={styles.kicker}>调度分析平台</p>
          <p className={styles.brand}>驳船调度可视化分析系统</p>
        </div>

        <nav className={styles.nav} aria-label='主导航'>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type='button' className={styles.themeButton} onClick={toggleTheme}>
          {mode === 'dark' ? '切换浅色' : '切换深色'}
        </button>
      </div>
    </header>
  )
}
