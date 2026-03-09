import { useEffect, useMemo, useRef, useState } from 'react'
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

const OPEN_FREE_MAP_SOURCES = {
  openmaptiles: {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/planet'
  }
} as const

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
      background: '#0f172a',
      water: '#102844',
      waterLine: '#214164',
      land: '#121b2b',
      green: '#162739',
      building: '#233047',
      buildingEdge: '#364862',
      roadCase: '#121b2b',
      roadMain: '#3a6286',
      roadMinor: '#2a4158',
      rail: '#53728f',
      boundary: '#34d399',
      label: '#e6edf7',
      labelHalo: '#0f172a'
    }
  }

  return {
    background: '#edf3f9',
    water: '#dbe6f2',
    waterLine: '#bfcedf',
    land: '#f8fbfe',
    green: '#e4efe8',
    building: '#dde6ef',
    buildingEdge: '#bccada',
    roadCase: '#f8fbfe',
    roadMain: '#a3b4c7',
    roadMinor: '#d5deea',
    rail: '#90a1b4',
    boundary: '#0f766e',
    label: '#334155',
    labelHalo: '#f8fbfe'
  }
}

function buildMapStyle(theme: 'light' | 'dark') {
  const palette = getThemePalette(theme)

  return {
    version: 8,
    name: `port-location-${theme}`,
    sources: OPEN_FREE_MAP_SOURCES,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': palette.background
        }
      },
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
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': palette.roadMain,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.5, 10, 2, 16, 11],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 8, 0.82]
        }
      },
      {
        id: 'railway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
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
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town'],
        layout: {
          'text-field': '{name}',
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 14, 12, 18],
          'text-anchor': 'center',
          'text-max-width': 8
        },
        paint: {
          'text-color': palette.label,
          'text-halo-color': palette.labelHalo,
          'text-halo-width': 1.5,
          'text-halo-blur': 0.5
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

  const portSummary = useMemo(() => {
    if (ports.length === 0) {
      return null
    }

    const sortedNames = ports
      .map(port => port.name)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))

    return {
      count: ports.length,
      sample: sortedNames.slice(0, 6).join('、')
    }
  }, [ports])

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

        <div className={styles.overlayTop}>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>地图数据</p>
            <p className={styles.infoValue}>OpenStreetMap · OpenFreeMap</p>
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>港口数量</p>
            <p className={styles.infoValue}>{portSummary?.count ?? '--'} 个</p>
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>联动港口</p>
            <p className={styles.infoValue}>{selectedPortCode ?? '全部港口'}</p>
          </div>
        </div>

        <div className={styles.overlayBottom}>
          <div className={styles.hintCard}>
            <p className={styles.hintTitle}>查看方式</p>
            <p className={styles.hintText}>拖拽缩放地图，点击港口编码即可联动筛选其他视图。</p>
          </div>
        </div>

        {isLoading ? <div className={styles.statusMask}>正在加载港口地图...</div> : null}

        {errorMessage ? <div className={styles.statusMask}>{errorMessage}</div> : null}
      </div>

      {portSummary ? (
        <footer className={styles.summary}>
          <p className={styles.summaryTitle}>港口样例</p>
          <p className={styles.summaryText}>{portSummary.sample}</p>
        </footer>
      ) : null}
    </section>
  )
}
