import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import type { SceneOption } from '@/shared/constants/scenarioConfig'

type SceneState = {
  availableScenes: SceneOption[]
  activeSceneId: string | null
}

const initialState: SceneState = {
  availableScenes: [],
  activeSceneId: null
}

const sceneSlice = createSlice({
  name: 'scene',
  initialState,
  reducers: {
    setAvailableScenes(state, action: PayloadAction<SceneOption[]>) {
      state.availableScenes = action.payload

      const hasActiveScene = action.payload.some(scene => scene.id === state.activeSceneId)
      if (!hasActiveScene) {
        state.activeSceneId = action.payload[0]?.id ?? null
      }
    },
    setActiveSceneId(state, action: PayloadAction<string>) {
      state.activeSceneId = action.payload
    }
  }
})

export const { setAvailableScenes, setActiveSceneId } = sceneSlice.actions

export const sceneReducer = sceneSlice.reducer

export const selectAvailableScenes = (state: RootState) => state.scene.availableScenes
export const selectActiveSceneId = (state: RootState) => state.scene.activeSceneId
export const selectActiveScene = (state: RootState) =>
  state.scene.availableScenes.find(scene => scene.id === state.scene.activeSceneId) ?? null
