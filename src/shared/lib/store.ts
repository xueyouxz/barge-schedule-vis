import { configureStore } from '@reduxjs/toolkit'
import { dashboardFilterReducer } from './dashboardFilterSlice'
import { sceneReducer } from './sceneSlice'

export const store = configureStore({
  reducer: {
    dashboardFilter: dashboardFilterReducer,
    scene: sceneReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
