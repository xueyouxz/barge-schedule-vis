/// <reference types="vite/client" />

interface Window {
  maplibregl?: {
    Map: new (options: Record<string, unknown>) => {
      addControl: (control: unknown, position?: string) => void
      fitBounds: (
        bounds: [[number, number], [number, number]],
        options?: Record<string, unknown>
      ) => void
      flyTo: (options: Record<string, unknown>) => void
      getBearing: () => number
      getCenter: () => { lng: number; lat: number }
      getPitch: () => number
      getZoom: () => number
      jumpTo: (options: Record<string, unknown>) => void
      on: (event: string, callback: () => void) => void
      once: (event: string, callback: () => void) => void
      remove: () => void
      setStyle: (style: Record<string, unknown>) => void
    }
    Marker: new (options?: { element?: HTMLElement; anchor?: string }) => {
      addTo: (map: unknown) => unknown
      remove: () => void
      setLngLat: (lngLat: [number, number]) => unknown
      setPopup: (popup: unknown) => unknown
    }
    NavigationControl: new () => unknown
    AttributionControl: new (options?: Record<string, unknown>) => unknown
    Popup: new (options?: Record<string, unknown>) => {
      setHTML: (html: string) => unknown
    }
  }
}
