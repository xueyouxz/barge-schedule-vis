import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './DashboardShell.module.css'

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

export function DashboardShell({ children }: { children: ReactNode }) {
  const [shellStyle, setShellStyle] = useState<CSSProperties>({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT
  })

  useEffect(() => {
    const resize = () => {
      const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)
      const translateX = (window.innerWidth - DESIGN_WIDTH * scale) / 2
      const translateY = (window.innerHeight - DESIGN_HEIGHT * scale) / 2

      setShellStyle({
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin: '0 0'
      })
    }

    resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className={styles.viewport}>
      <div className={styles.shell} style={shellStyle}>
        {children}
      </div>
    </div>
  )
}
