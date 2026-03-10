import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@/shared/lib/fetchUtils'
import { SCENES_MANIFEST_PATH, type SceneOption } from '@/shared/constants/scenarioConfig'

type SceneManifest = {
  scenes: SceneOption[]
}

export function useSceneManifest() {
  return useQuery({
    queryKey: ['scene-manifest'],
    queryFn: async () => {
      const manifest = await fetchJson<SceneManifest>(SCENES_MANIFEST_PATH)
      return manifest.scenes
    }
  })
}
