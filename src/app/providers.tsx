import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { store } from '@/shared/lib/store'
import { ThemeProvider } from '@/shared/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 60 * 60 * 1000,
      retry: 1
    }
  }
})

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    </ThemeProvider>
  )
}
