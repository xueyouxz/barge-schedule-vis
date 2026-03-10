import styles from './ViewStateOverlay.module.css'

interface ViewStateOverlayProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  loadingText?: string
  emptyText?: string
  overlay?: boolean
}

export function ViewStateOverlay({
  loading = false,
  error,
  empty = false,
  loadingText = '加载中...',
  emptyText = '暂无数据',
  overlay = false
}: ViewStateOverlayProps) {
  let text: string | null = null
  let toneClassName = styles.muted

  if (loading) {
    text = loadingText
  } else if (error) {
    text = error
    toneClassName = styles.error
  } else if (empty) {
    text = emptyText
  }

  if (!text) {
    return null
  }

  return (
    <div
      className={[styles.root, overlay ? styles.overlay : styles.inline, toneClassName].join(' ')}
    >
      {text}
    </div>
  )
}
