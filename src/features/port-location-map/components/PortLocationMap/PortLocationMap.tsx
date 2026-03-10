import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/shared/theme'
import styles from './PortLocationMap.module.css'

type PortLocationRecord = Record<
  string,
  {
    name: string
    lat: number
    lon: number
  }
>

type PortLocation = {
  code: string
  name: string
  lat: number
  lon: number
}

type PortMarkerInstance = {
  addTo: (map: unknown) => PortMarkerInstance
  remove: () => void
  setLngLat: (lngLat: [number, number]) => PortMarkerInstance
  setPopup: (popup: unknown) => PortMarkerInstance
}

type PopupInstance = {
  setHTML: (html: string) => PopupInstance
}

type MapLibreGlobal = NonNullable<Window['maplibregl']>

export interface PortLocationMapProps {
  compact?: boolean
  selectedPortCode?: string
  onPortSelect?: (portCode: string) => void
}

const MAPLIBRE_SCRIPT_ID = 'maplibre-gl-script'
const MAPLIBRE_STYLE_ID = 'maplibre-gl-style'
const MAPLIBRE_SCRIPT_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
const MAPLIBRE_STYLE_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'

const OPENMAPTILES_SOURCE = {
  type: 'vector',
  url: 'https://tiles.openfreemap.org/planet'
} as const

// Natural Earth shaded-relief raster — provides ocean/land context at zoom 0-6
const NE2_SHADED_SOURCE = {
  type: 'raster',
  maxzoom: 6,
  tileSize: 256,
  tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png']
} as const

function buildMapSources(_theme: 'light' | 'dark') {
  // Both themes reference ne2_shaded in their layers (dark uses it at near-zero
  // opacity for a subtle land/ocean tint). The source must be present in both.
  return { openmaptiles: OPENMAPTILES_SOURCE, ne2_shaded: NE2_SHADED_SOURCE }
}

let mapLibreLoader: Promise<MapLibreGlobal> | null = null

function loadMapLibreStylesheet() {
  if (document.getElementById(MAPLIBRE_STYLE_ID)) {
    return
  }

  const link = document.createElement('link')
  link.id = MAPLIBRE_STYLE_ID
  link.rel = 'stylesheet'
  link.href = MAPLIBRE_STYLE_URL
  document.head.append(link)
}

function loadMapLibreScript() {
  if (window.maplibregl) {
    return Promise.resolve(window.maplibregl)
  }

  if (mapLibreLoader) {
    return mapLibreLoader
  }

  mapLibreLoader = new Promise<MapLibreGlobal>((resolve, reject) => {
    const existingScript = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.maplibregl) {
          resolve(window.maplibregl)
          return
        }

        reject(new Error('MapLibre GL 加载完成，但未找到全局对象'))
      })

      existingScript.addEventListener('error', () => {
        reject(new Error('MapLibre GL 脚本加载失败'))
      })

      return
    }

    const script = document.createElement('script')
    script.id = MAPLIBRE_SCRIPT_ID
    script.src = MAPLIBRE_SCRIPT_URL
    script.async = true

    script.addEventListener('load', () => {
      if (window.maplibregl) {
        resolve(window.maplibregl)
        return
      }

      reject(new Error('MapLibre GL 加载完成，但未找到全局对象'))
    })

    script.addEventListener('error', () => {
      reject(new Error('MapLibre GL 脚本加载失败'))
    })

    document.head.append(script)
  })

  return mapLibreLoader
}

function getThemePalette(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    return {
      background: '#161c23',
      water: '#1b2530',
      waterLine: '#33414e',
      land: '#161c23',
      green: '#1c232b',
      building: '#222b34',
      buildingEdge: '#3a4652',
      roadCase: '#161c23',
      roadMain: '#516171',
      roadMinor: '#36424d',
      rail: '#657383',
      boundary: '#71a7e2',
      label: '#edf1f5',
      labelHalo: '#161c23'
    }
  }

  return {
    background: '#ffffff',
    water: '#f3f7fb',
    waterLine: '#d9e2ea',
    land: '#ffffff',
    green: '#f5f7f9',
    building: '#eef2f5',
    buildingEdge: '#d6dde4',
    roadCase: '#ffffff',
    roadMain: '#c6d0d8',
    roadMinor: '#e1e6eb',
    rail: '#aab6c2',
    boundary: '#2f6db2',
    label: '#334155',
    labelHalo: '#ffffff'
  }
}

function buildMapStyle(theme: 'light' | 'dark') {
  const palette = getThemePalette(theme)

  return {
    version: 8,
    name: `port-location-${theme}`,
    sources: buildMapSources(theme),
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': palette.background
        }
      },
      // Natural Earth shaded relief — fills the visual gap at zoom 0-6 where
      // vector tile data is too sparse to form a recognisable map
      ...(theme === 'light'
        ? [
            {
              id: 'natural_earth',
              type: 'raster',
              source: 'ne2_shaded',
              maxzoom: 7,
              paint: {
                'raster-opacity': ['interpolate', ['exponential', 1.5], ['zoom'], 0, 0.9, 6, 0.12]
              }
            }
          ]
        : []),
      // dark mode: a subtle dark-tinted raster helps distinguish land from ocean
      ...(theme === 'dark'
        ? [
            {
              id: 'natural_earth',
              type: 'raster',
              source: 'ne2_shaded',
              maxzoom: 7,
              paint: {
                'raster-opacity': ['interpolate', ['exponential', 1.5], ['zoom'], 0, 0.18, 5, 0.04],
                'raster-brightness-max': 0.25,
                'raster-saturation': -1
              }
            }
          ]
        : []),
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {
          'fill-color': palette.water,
          'fill-opacity': 0.95
        }
      },
      {
        id: 'water-outline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {
          'line-color': palette.waterLine,
          'line-width': 1
        }
      },
      {
        id: 'landcover-green',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', 'class', 'grass'],
        paint: {
          'fill-color': palette.green,
          'fill-opacity': 0.6
        }
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: {
          'fill-color': palette.green,
          'fill-opacity': 0.45
        }
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': palette.building,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 0.72]
        }
      },
      {
        id: 'building-outline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'line-color': palette.buildingEdge,
          'line-width': 0.5,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 0.6]
        }
      },
      {
        id: 'road-case',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 10,
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': palette.roadCase,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 1, 10, 4, 16, 20],
          'line-opacity': 0.45
        }
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'street'],
        minzoom: 12,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': palette.roadMinor,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.5, 16, 4],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, 0.68]
        }
      },
      {
        id: 'road-main',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 10,
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': palette.roadMain,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.5, 10, 2, 16, 11],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11, 0.82]
        }
      },
      {
        id: 'railway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 10,
        filter: ['==', 'class', 'rail'],
        paint: {
          'line-color': palette.rail,
          'line-width': 1.2,
          'line-dasharray': [3, 3],
          'line-opacity': 0.45
        }
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', 'admin_level', 4],
        paint: {
          'line-color': palette.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 10, 1.8],
          'line-dasharray': [4, 2],
          'line-opacity': 0.45
        }
      }
    ]
  }
}

function formatCoordinate(value: number) {
  return value.toFixed(4)
}

function buildPopupHtml(port: PortLocation) {
  return `
    <div class="${styles.popupCard}">
      <div class="${styles.popupCode}">${port.code}</div>
      <div class="${styles.popupName}">${port.name}</div>
      <div class="${styles.popupMeta}">经度 ${formatCoordinate(port.lon)} · 纬度 ${formatCoordinate(port.lat)}</div>
    </div>
  `
}

function createMarkerElement(port: PortLocation, onPortSelect?: (portCode: string) => void) {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = styles.marker
  element.setAttribute('aria-label', `${port.name} (${port.code})`)
  element.dataset.portCode = port.code
  element.innerHTML = `
    <span class="${styles.markerDot}"></span>
    <span class="${styles.markerLabel}">${port.code}</span>
  `

  if (onPortSelect) {
    element.addEventListener('click', () => {
      onPortSelect(port.code)
    })
  }

  return element
}

function getBounds(ports: PortLocation[]) {
  const lons = ports.map(port => port.lon)
  const lats = ports.map(port => port.lat)

  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)]
  ] as [[number, number], [number, number]]
}

export function PortLocationMap({
  compact = false,
  selectedPortCode,
  onPortSelect
}: PortLocationMapProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<InstanceType<MapLibreGlobal['Map']> | null>(null)
  const markersRef = useRef<PortMarkerInstance[]>([])
  const markerElementsRef = useRef(new Map<string, HTMLButtonElement>())
  const onPortSelectRef = useRef(onPortSelect)
  const themeRef = useRef(theme)
  const appliedThemeRef = useRef<'light' | 'dark' | null>(null)
  const [ports, setPorts] = useState<PortLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    onPortSelectRef.current = onPortSelect
  }, [onPortSelect])

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    let isCancelled = false

    async function loadPorts() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch('/data/common/port_locations.json')
        if (!response.ok) {
          throw new Error(`港口数据读取失败：${response.status}`)
        }

        const payload = (await response.json()) as PortLocationRecord
        if (isCancelled) {
          return
        }

        const nextPorts = Object.entries(payload)
          .map(([code, value]) => ({
            code,
            name: value.name,
            lat: value.lat,
            lon: value.lon
          }))
          .sort((left, right) => left.code.localeCompare(right.code))

        setPorts(nextPorts)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : '港口数据读取失败')
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPorts()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || ports.length === 0) {
      return undefined
    }

    let isDisposed = false
    let currentMarkers: PortMarkerInstance[] = []
    markerElementsRef.current = new Map<string, HTMLButtonElement>()

    async function initializeMap() {
      loadMapLibreStylesheet()
      const maplibre = await loadMapLibreScript()

      if (isDisposed || !containerRef.current) {
        return
      }

      const map = new maplibre.Map({
        container: containerRef.current,
        style: buildMapStyle(themeRef.current),
        center: [120.5, 31.4],
        zoom: 6.4,
        attributionControl: false
      })

      appliedThemeRef.current = themeRef.current
      mapRef.current = map

      map.addControl(new maplibre.NavigationControl(), 'bottom-right')
      map.addControl(
        new maplibre.AttributionControl({
          compact: true,
          customAttribution: '© OSM · OpenFreeMap'
        }),
        'bottom-left'
      )

      map.on('load', () => {
        if (isDisposed) {
          return
        }

        currentMarkers = ports.map(port => {
          const markerElement = createMarkerElement(port, code => {
            onPortSelectRef.current?.(code)
          })
          markerElementsRef.current.set(port.code, markerElement)
          const popup = new maplibre.Popup({
            offset: 16,
            closeButton: false,
            className: styles.popup
          }) as PopupInstance

          popup.setHTML(buildPopupHtml(port))

          const marker = new maplibre.Marker({
            element: markerElement,
            anchor: 'center'
          }) as PortMarkerInstance

          marker.setLngLat([port.lon, port.lat])
          marker.setPopup(popup)

          return marker
        })

        currentMarkers.forEach(marker => {
          marker.addTo(map)
        })

        markersRef.current = currentMarkers

        markerElementsRef.current.forEach((element, code) => {
          element.classList.toggle(styles.markerActive, code === selectedPortCode)
        })

        const selectedPort = selectedPortCode
          ? ports.find(port => port.code === selectedPortCode)
          : null

        if (selectedPort) {
          map.flyTo({
            center: [selectedPort.lon, selectedPort.lat],
            zoom: 7.4,
            essential: true,
            duration: 0
          })
          return
        }

        map.fitBounds(getBounds(ports), {
          padding: 72,
          maxZoom: 8.2,
          duration: 0
        })
      })
    }

    void initializeMap()

    return () => {
      isDisposed = true
      currentMarkers.forEach(marker => marker.remove())
      markersRef.current = []
      markerElementsRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
      appliedThemeRef.current = null
    }
  }, [ports, selectedPortCode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || appliedThemeRef.current === theme) {
      return
    }

    const center = map.getCenter()
    const zoom = map.getZoom()
    const bearing = map.getBearing()
    const pitch = map.getPitch()

    appliedThemeRef.current = theme
    map.setStyle(buildMapStyle(theme))
    map.once('style.load', () => {
      map.jumpTo({
        center: [center.lng, center.lat],
        zoom,
        bearing,
        pitch
      })
    })
  }, [theme])

  useEffect(() => {
    markerElementsRef.current.forEach((element, code) => {
      element.classList.toggle(styles.markerActive, code === selectedPortCode)
    })

    if (!selectedPortCode || !mapRef.current) {
      return
    }

    const selectedPort = ports.find(port => port.code === selectedPortCode)
    if (!selectedPort) {
      return
    }

    mapRef.current.flyTo({
      center: [selectedPort.lon, selectedPort.lat],
      zoom: Math.max(mapRef.current.getZoom(), 7.2),
      essential: true,
      duration: 900
    })
  }, [ports, selectedPortCode])

  return (
    <section className={styles.shell}>
      <div className={`${styles.stage} ${compact ? styles.stageCompact : ''}`.trim()}>
        <div
          ref={containerRef}
          className={`${styles.map} ${compact ? styles.mapCompact : ''}`.trim()}
        />

        {isLoading ? <div className={styles.statusMask}>正在加载港口地图...</div> : null}

        {errorMessage ? <div className={styles.statusMask}>{errorMessage}</div> : null}
      </div>
    </section>
  )
}
