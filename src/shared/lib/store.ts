import { configureStore } from '@reduxjs/toolkit'
import { dashboardFilterReducer } from './dashboardFilterSlice'

export const store = configureStore({
  reducer: {
    dashboardFilter: dashboardFilterReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
