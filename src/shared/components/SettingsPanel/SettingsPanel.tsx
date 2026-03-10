import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks'
import { resetDashboardFilter } from '@/shared/lib/dashboardFilterSlice'
import {
  selectActiveSceneId,
  selectAvailableScenes,
  setActiveSceneId,
  setAvailableScenes
} from '@/shared/lib/sceneSlice'
import { useSceneManifest } from '@/shared/hooks/useSceneManifest'
import styles from './SettingsPanel.module.css'

type SettingsPanelProps = {
  showHeading?: boolean
}

export function SettingsPanel({ showHeading = true }: SettingsPanelProps) {
  const dispatch = useAppDispatch()
  const scenes = useAppSelector(selectAvailableScenes)
  const activeSceneId = useAppSelector(selectActiveSceneId)
  const manifestQuery = useSceneManifest()

  useEffect(() => {
    if (!manifestQuery.data) {
      return
    }

    dispatch(setAvailableScenes(manifestQuery.data))
  }, [dispatch, manifestQuery.data])

  const handleSceneChange = (sceneId: string) => {
    if (!sceneId || sceneId === activeSceneId) {
      return
    }

    dispatch(setActiveSceneId(sceneId))
    dispatch(resetDashboardFilter())
  }

  return (
    <aside className={styles.panel}>
      {showHeading ? (
        <div className={styles.panelHeader}>
          <span className={styles.kicker}>Scenario Control</span>
          <span className={styles.title}>场景设置</span>
        </div>
      ) : null}

      <label className={styles.field}>
        <span className={styles.label}>切换数据</span>
        <select
          className={styles.select}
          value={activeSceneId ?? ''}
          onChange={event => handleSceneChange(event.target.value)}
          disabled={manifestQuery.isLoading || scenes.length === 0}
        >
          <option value='' disabled>
            {manifestQuery.isLoading ? '读取场景中...' : '请选择场景'}
          </option>
          {scenes.map(scene => (
            <option key={scene.id} value={scene.id}>
              {scene.label}
            </option>
          ))}
        </select>
      </label>
    </aside>
  )
}
