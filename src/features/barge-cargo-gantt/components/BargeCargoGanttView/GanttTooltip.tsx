import { fmtDate, fmtHours } from '@/shared/lib/formatUtils'
import { resolvePortColor } from '@/shared/lib/portColors'
import type { ResolvedTheme } from '@/shared/theme/theme.types'
import styles from './BargeCargoGanttView.module.css'
import type { InteractiveEvent } from './types'

type TooltipPosition = {
  x: number
  y: number
}

interface GanttTooltipProps {
  event: InteractiveEvent | null
  position: TooltipPosition
  visible: boolean
}

interface CargoDetailPopupProps {
  event: InteractiveEvent | null
  position: TooltipPosition
  portColorMap: Map<string, string>
  theme: ResolvedTheme
  onClose: () => void
}

export function GanttTooltip({ event, position, visible }: GanttTooltipProps) {
  const loadRate =
    event && 'teu' in event && event.teu && 'maxTeu' in event && event.maxTeu
      ? `${Math.round((event.teu / event.maxTeu) * 100)}%`
      : '-'

  return (
    <div
      className={styles.tooltip}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity: visible && event ? 1 : 0
      }}
    >
      {event ? (
        <>
          <strong>
            {event.vessel} / {event.voyage}
          </strong>
          <div>类型：{event.type}</div>
          <div>港口：{event.port}</div>
          <div>
            时段：{fmtDate(event.startTime)} ~ {fmtDate(event.endTime)}
          </div>
          <div>箱数：{'teu' in event ? (event.teu ?? '-') : '-'}</div>
          <div>箱量占比：{loadRate}</div>
          {'cargo' in event && event.cargo ? (
            <>
              <div>
                箱型：大箱 {event.cargo.big} / 小箱 {event.cargo.normal} / 危险品{' '}
                {event.cargo.danger}
              </div>
              <div>船上箱数：{event.cargo.onboard}</div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function CargoDetailPopup({
  event,
  position,
  portColorMap,
  theme,
  onClose
}: CargoDetailPopupProps) {
  if (!event) {
    return null
  }

  const groups = event.cargoDetail?.groups ?? []
  const maxGroupCount = groups.reduce((maxCount, group) => Math.max(maxCount, group.count), 0)

  return (
    <div
      className={styles.cargoPopup}
      style={{ left: position.x, top: position.y }}
      onClick={mouseEvent => mouseEvent.stopPropagation()}
    >
      <div className={styles.cargoPopupHeader}>
        <div className={styles.cargoPopupPortName}>{event.port}</div>
        <button className={styles.cargoPopupClose} onClick={onClose} title='关闭' type='button'>
          ×
        </button>
      </div>

      <div className={styles.cargoPopupMeta}>
        <span>{event.vessel}</span>
        <span>{event.voyage}</span>
      </div>

      {groups.length === 0 ? (
        <div className={styles.cargoPopupEmpty}>暂无装货明细数据</div>
      ) : (
        <div className={styles.portBarChart}>
          {groups.map(group => {
            const pct = maxGroupCount > 0 ? (group.count / maxGroupCount) * 100 : 0
            const fill =
              portColorMap.get(group.mainlinePort) ?? resolvePortColor(group.mainlinePort, theme)

            return (
              <div key={group.mainlinePort} className={styles.portBarChartRow}>
                <div className={styles.portBarChartTrack}>
                  <div
                    className={styles.portBarChartFill}
                    style={{ width: `${pct}%`, background: fill }}
                    title={`${group.mainlinePort}：${group.count} 箱 · ${fmtHours(group.teu)} TEU`}
                  >
                    <span className={styles.portBarChartBarLabel}>{group.mainlinePort}</span>
                  </div>
                </div>
                <div className={styles.portBarChartValue}>
                  {group.count} 箱/ {fmtHours(group.teu)} TEU
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
