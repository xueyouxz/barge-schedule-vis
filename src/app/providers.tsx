import type { PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { store } from '@/shared/lib/store'
import { ThemeProvider } from '@/shared/theme'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <Provider store={store}>{children}</Provider>
    </ThemeProvider>
  )
}
