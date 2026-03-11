import { useState, useEffect, useCallback, useRef } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { usePortLocations } from '@/shared/hooks/usePortLocations'
import type { NingboTerminalId } from '../constants/terminalConfig'

export interface TerminalPixelPoint {
  x: number
  y: number
}

export type TerminalPixelMap = Map<NingboTerminalId, TerminalPixelPoint>

export interface TerminalProjectionResult {
  /** 各宁波码头在屏幕上的像素坐标（相对于地图 canvas 左上角） */
  pixelMap: TerminalPixelMap
  /** 所有活跃码头的加权质心 X（用作弦图中心） */
  centerX: number
  /** 所有活跃码头的加权质心 Y（用作弦图中心） */
  centerY: number
}

/**
 * 实时将 activeTerminals 中各码头的经纬度投影到屏幕像素坐标。
 * 监听地图的 move/zoom/rotate/pitch/resize 事件，通过 rAF 节流更新。
 */
export function useNingboTerminalProjection(
  mapRef: React.RefObject<MapRef | null>,
  activeTerminals: NingboTerminalId[]
): TerminalProjectionResult {
  const { data: portLocations } = usePortLocations()
  const [pixelMap, setPixelMap] = useState<TerminalPixelMap>(new Map())

  const rafRef = useRef<number | null>(null)
  // 用 ref 保存最新的 activeTerminals 避免 stale closure
  const activeTerminalsRef = useRef(activeTerminals)
  const portLocationsRef = useRef(portLocations)
  activeTerminalsRef.current = activeTerminals
  portLocationsRef.current = portLocations

  const updateProjection = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const next: TerminalPixelMap = new Map()
    for (const id of activeTerminalsRef.current) {
      const geo = portLocationsRef.current.find(p => p.code === id)
      if (!geo) continue
      const pt = map.project([geo.lon, geo.lat])
      next.set(id, { x: pt.x, y: pt.y })
    }
    setPixelMap(next)
  }, [mapRef])

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateProjection()
    })
  }, [updateProjection])

  // 监听地图视图变化事件
  useEffect(() => {
    const nativeMap = mapRef.current?.getMap()
    if (!nativeMap) return

    updateProjection()

    const events = ['move', 'zoom', 'rotate', 'pitch', 'resize'] as const
    events.forEach(e => nativeMap.on(e, scheduleUpdate))

    return () => {
      events.forEach(e => nativeMap.off(e, scheduleUpdate))
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current, scheduleUpdate, updateProjection])

  // 当活跃码头列表变化时重新投影
  useEffect(() => {
    updateProjection()
  }, [activeTerminals, portLocations, updateProjection])

  // 计算加权质心（简单均值，弦图码头数量少，加权效果差异不大）
  const center = (() => {
    if (pixelMap.size === 0) return { centerX: 0, centerY: 0 }
    let sumX = 0
    let sumY = 0
    for (const [, pt] of pixelMap) {
      sumX += pt.x
      sumY += pt.y
    }
    return {
      centerX: sumX / pixelMap.size,
      centerY: sumY / pixelMap.size
    }
  })()

  return { pixelMap, ...center }
}
