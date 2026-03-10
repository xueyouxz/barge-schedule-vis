import { useAppSelector } from '@/shared/lib/hooks'
import { buildDataPaths } from '@/shared/constants/scenarioConfig'
import { selectActiveScene } from '@/shared/lib/sceneSlice'

export function useActiveSceneDataPaths() {
  const activeScene = useAppSelector(selectActiveScene)
  return buildDataPaths(activeScene)
}
