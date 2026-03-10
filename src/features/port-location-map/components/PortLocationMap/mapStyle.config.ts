import type {
  RasterSourceSpecification,
  StyleSpecification,
  VectorSourceSpecification
} from 'maplibre-gl'
import type { ResolvedTheme } from '@/shared/theme/theme.types'

const OPENMAPTILES_SOURCE: VectorSourceSpecification = {
  type: 'vector',
  url: 'https://tiles.openfreemap.org/planet'
}

const NE2_SHADED_SOURCE: RasterSourceSpecification = {
  type: 'raster',
  maxzoom: 6,
  tileSize: 256,
  tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png']
}

function buildMapSources() {
  return {
    openmaptiles: OPENMAPTILES_SOURCE,
    ne2_shaded: NE2_SHADED_SOURCE
  }
}

/**
 * Keep this palette in sync with src/styles/variables.css.
 *
 * Current mapping:
 * - background -> --color-background
 * - boundary -> --chart-unload
 * - label -> --chart-text / --chart-text-muted family
 *
 * MapLibre styles cannot read CSS custom properties directly, so these values
 * must be updated manually when the global theme palette changes.
 */
export function getThemePalette(theme: ResolvedTheme) {
  if (theme === 'dark') {
    return {
      background: '#11161c',
      water: '#1b2530',
      waterLine: '#33414e',
      green: '#1c232b',
      building: '#222b34',
      buildingEdge: '#3a4652',
      roadCase: '#11161c',
      roadMain: '#516171',
      roadMinor: '#36424d',
      rail: '#657383',
      boundary: '#71a7e2',
      label: '#edf1f5'
    }
  }

  return {
    background: '#ffffff',
    water: '#f3f7fb',
    waterLine: '#d9e2ea',
    green: '#f5f7f9',
    building: '#eef2f5',
    buildingEdge: '#d6dde4',
    roadCase: '#ffffff',
    roadMain: '#c6d0d8',
    roadMinor: '#e1e6eb',
    rail: '#aab6c2',
    boundary: '#2f6db2',
    label: '#334155'
  }
}

export const MAP_DEFAULTS = {
  center: {
    longitude: 120.5,
    latitude: 31.4
  },
  zoom: 6.4,
  selectedZoom: 7.4,
  minSelectedZoom: 7.2,
  maxFitZoom: 8.2,
  fitBoundsPadding: 72,
  selectedDuration: 900
} as const

export function buildMapStyle(theme: ResolvedTheme): StyleSpecification {
  const palette = getThemePalette(theme)

  return {
    version: 8,
    name: `port-location-${theme}`,
    sources: buildMapSources(),
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': palette.background
        }
      },
      ...(theme === 'light'
        ? [
            {
              id: 'natural-earth',
              type: 'raster',
              source: 'ne2_shaded',
              maxzoom: 7,
              paint: {
                'raster-opacity': ['interpolate', ['exponential', 1.5], ['zoom'], 0, 0.9, 6, 0.12]
              }
            } satisfies StyleSpecification['layers'][number]
          ]
        : [
            {
              id: 'natural-earth',
              type: 'raster',
              source: 'ne2_shaded',
              maxzoom: 7,
              paint: {
                'raster-opacity': ['interpolate', ['exponential', 1.5], ['zoom'], 0, 0.18, 5, 0.04],
                'raster-brightness-max': 0.25,
                'raster-saturation': -1
              }
            } satisfies StyleSpecification['layers'][number]
          ]),
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
