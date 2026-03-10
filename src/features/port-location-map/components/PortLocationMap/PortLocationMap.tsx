import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import Map, {
  AttributionControl,
  Marker,
  NavigationControl,
  Popup,
  type MapRef
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ViewStateOverlay } from '@/shared/components/ViewStateOverlay/ViewStateOverlay'
import { resolvePortColor } from '@/shared/lib/portColors'
import { useTheme } from '@/shared/theme'
import { usePortLocations, type PortLocation } from '@/shared/hooks/usePortLocations'
import { buildMapStyle, MAP_DEFAULTS } from './mapStyle.config'
import styles from './PortLocationMap.module.css'
import type { CSSProperties } from 'react'

export interface PortLocationMapProps {
  compact?: boolean
  fillContainer?: boolean
  selectedPortCode?: string
  onPortSelect?: (portCode: string) => void
}

function getBounds(ports: PortLocation[]) {
  const longitudes = ports.map(port => port.lon)
  const latitudes = ports.map(port => port.lat)

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)]
  ] as [[number, number], [number, number]]
}

function formatCoordinate(value: number) {
  return value.toFixed(4)
}

export function PortLocationMap({
  compact = false,
  fillContainer = false,
  selectedPortCode,
  onPortSelect
}: PortLocationMapProps) {
  const { theme } = useTheme()
  const mapRef = useRef<MapRef | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [internalSelectedPortCode, setInternalSelectedPortCode] = useState<string>()
  const { data: ports, isLoading, error } = usePortLocations()
  const effectiveSelectedPortCode = selectedPortCode ?? internalSelectedPortCode
  const selectedPort = useMemo(
    () => ports.find(port => port.code === effectiveSelectedPortCode) ?? null,
    [effectiveSelectedPortCode, ports]
  )

  useEffect(() => {
    if (!isMapReady || ports.length === 0 || !mapRef.current) {
      return
    }

    if (selectedPort) {
      mapRef.current.flyTo({
        center: [selectedPort.lon, selectedPort.lat],
        zoom: Math.max(mapRef.current.getZoom(), MAP_DEFAULTS.minSelectedZoom),
        essential: true,
        duration: MAP_DEFAULTS.selectedDuration
      })
      return
    }

    mapRef.current.fitBounds(getBounds(ports), {
      padding: MAP_DEFAULTS.fitBoundsPadding,
      maxZoom: MAP_DEFAULTS.maxFitZoom,
      duration: 0
    })
  }, [isMapReady, ports, selectedPort])

  const handlePortSelect = (portCode: string) => {
    if (onPortSelect) {
      onPortSelect(portCode)
      return
    }

    setInternalSelectedPortCode(current => (current === portCode ? undefined : portCode))
  }

  return (
    <section className={`${styles.shell} ${fillContainer ? styles.shellFill : ''}`.trim()}>
      <div
        className={[
          styles.stage,
          compact ? styles.stageCompact : '',
          fillContainer ? styles.stageFill : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Map
          ref={mapRef}
          attributionControl={false}
          initialViewState={{
            longitude: MAP_DEFAULTS.center.longitude,
            latitude: MAP_DEFAULTS.center.latitude,
            zoom: MAP_DEFAULTS.zoom
          }}
          mapLib={maplibregl}
          mapStyle={buildMapStyle(theme)}
          onLoad={() => setIsMapReady(true)}
          reuseMaps
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position='bottom-right' />
          <AttributionControl
            compact
            customAttribution='© OSM · OpenFreeMap'
            position='bottom-left'
          />

          {ports.map(port => (
            <Marker key={port.code} anchor='center' longitude={port.lon} latitude={port.lat}>
              <button
                aria-label={`${port.name} (${port.code})`}
                className={`${styles.marker} ${effectiveSelectedPortCode === port.code ? styles.markerActive : ''}`.trim()}
                onClick={() => handlePortSelect(port.code)}
                style={
                  {
                    '--marker-port-color': resolvePortColor(port.code, theme)
                  } as CSSProperties
                }
                type='button'
              >
                <span className={styles.markerDot} />
                <span className={styles.markerLabel}>{port.code}</span>
              </button>
            </Marker>
          ))}

          {selectedPort ? (
            <Popup
              anchor='bottom'
              className={styles.popup}
              closeButton={false}
              closeOnClick={false}
              longitude={selectedPort.lon}
              latitude={selectedPort.lat}
              offset={16}
            >
              <div className={styles.popupCard}>
                <div className={styles.popupCode}>{selectedPort.code}</div>
                <div className={styles.popupName}>{selectedPort.name}</div>
                <div className={styles.popupMeta}>
                  经度 {formatCoordinate(selectedPort.lon)} · 纬度{' '}
                  {formatCoordinate(selectedPort.lat)}
                </div>
              </div>
            </Popup>
          ) : null}
        </Map>

        <ViewStateOverlay
          overlay
          loading={isLoading}
          error={error}
          loadingText='正在加载港口地图...'
        />
      </div>
    </section>
  )
}
