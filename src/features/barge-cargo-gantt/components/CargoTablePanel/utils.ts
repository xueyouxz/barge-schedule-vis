import type { GanttEvent } from '../BargeCargoGanttView/types'

export function getEventTypeLabel(eventType: GanttEvent['type']): string {
  switch (eventType) {
    case 'loading':
      return '装货'
    case 'unloading':
      return '卸货'
    case 'waiting':
      return '等待'
    case 'wrapup':
      return '收尾'
    case 'sailing':
      return '航行'
    default:
      return eventType
  }
}
