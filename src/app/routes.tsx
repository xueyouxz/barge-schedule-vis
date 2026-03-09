import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'

const HomePage = lazy(() => import('@/features/home/components/HomePage'))
const BargeCargoGanttPage = lazy(
  () => import('@/features/barge-cargo-gantt/pages/BargeCargoGanttPage')
)
const PortCargoByMainlinePage = lazy(
  () => import('@/features/port-cargo-mainline/pages/PortCargoByMainlinePage')
)
const PortLocationMapPage = lazy(
  () => import('@/features/port-location-map/pages/PortLocationMapPage')
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <HomePage />
          </Suspense>
        )
      },
      {
        path: 'barge-cargo-gantt',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <BargeCargoGanttPage />
          </Suspense>
        )
      },
      {
        path: 'port-cargo-mainline',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <PortCargoByMainlinePage />
          </Suspense>
        )
      },
      {
        path: 'port-location-map',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <PortLocationMapPage />
          </Suspense>
        )
      }
    ]
  }
])
