import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import styles from './MainLayout.module.css'

export function MainLayout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const hideHeader = isHome

  return (
    <div className={styles.shell}>
      {hideHeader ? null : <Header />}
      <main className={`${styles.main} ${isHome ? styles.mainHome : ''}`.trim()}>
        <Outlet />
      </main>
    </div>
  )
}
