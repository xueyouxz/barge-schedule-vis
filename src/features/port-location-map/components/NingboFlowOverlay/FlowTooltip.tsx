import { createPortal } from 'react-dom'
import styles from './FlowTooltip.module.css'

export interface FlowTooltipState {
  visible: boolean
  x: number
  y: number
  sourceName: string
  sourceId: string
  targetName: string
  targetId: string
  count: number
  /** true = 同码头直达（对角线自环） */
  isSelf: boolean
}

interface FlowTooltipProps {
  state: FlowTooltipState
}

export function FlowTooltip({ state }: FlowTooltipProps) {
  if (!state.visible) return null

  if (state.isSelf) {
    return createPortal(
      <div className={styles.tooltip} style={{ left: state.x + 14, top: state.y - 10 }}>
        <div className={styles.route}>
          <span className={styles.terminal}>{state.sourceId}</span>
          <span className={styles.selfBadge}>直达</span>
        </div>
        <div className={styles.names}>{state.sourceName}</div>
        <div className={styles.count}>
          <span className={styles.countValueSelf}>{state.count.toLocaleString()}</span>
          <span className={styles.countUnit}> 箱无需转码头</span>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className={styles.tooltip} style={{ left: state.x + 14, top: state.y - 10 }}>
      <div className={styles.route}>
        <span className={styles.terminal}>{state.sourceId}</span>
        <span className={styles.arrow}>→</span>
        <span className={styles.terminal}>{state.targetId}</span>
      </div>
      <div className={styles.names}>
        {state.sourceName}
        <span className={styles.arrowSub}> → </span>
        {state.targetName}
      </div>
      <div className={styles.count}>
        <span className={styles.countValue}>{state.count.toLocaleString()}</span>
        <span className={styles.countUnit}> 箱转码头</span>
      </div>
    </div>,
    document.body
  )
}
