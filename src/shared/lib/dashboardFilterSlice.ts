import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type DashboardFilterState = {
  selectedPort: string | null
}

const initialState: DashboardFilterState = {
  selectedPort: null
}

const dashboardFilterSlice = createSlice({
  name: 'dashboardFilter',
  initialState,
  reducers: {
    setSelectedPort(state, action: PayloadAction<string | null>) {
      state.selectedPort = action.payload
    },
    toggleSelectedPort(state, action: PayloadAction<string>) {
      state.selectedPort = state.selectedPort === action.payload ? null : action.payload
    },
    resetDashboardFilter() {
      return initialState
    }
  }
})

export const { resetDashboardFilter, setSelectedPort, toggleSelectedPort } =
  dashboardFilterSlice.actions

export const dashboardFilterReducer = dashboardFilterSlice.reducer
