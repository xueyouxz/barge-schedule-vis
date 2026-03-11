import type { PortMainlineRow } from '../../PortCargoByMainlineView/types'
import type { CargoTypeKey, DistributionNode, ForceGroup, GroupHull, TypeSlice } from '../types'
import {
  BOT_Y,
  CANVAS_W,
  FORCE_ITERATIONS,
  GROUP_Y_OFFSETS,
  INTER_PAD,
  INTRA_PAD,
  R_MAX,
  R_MIN,
  TOP_Y
} from '../config'

// ─── 半径计算 ────────────────────────────────────────────────────────────────

function getRadius(total: number, maxTotal: number): number {
  if (maxTotal <= 0) return R_MIN
  return R_MIN + (R_MAX - R_MIN) * Math.sqrt(total / maxTotal)
}

// ─── 数据转换：PortMainlineRow[] → ForceGroup[] ──────────────────────────────

/**
 * 将现有数据层的 PortMainlineRow[] 转换为力布局所需的 ForceGroup[]。
 *
 * 数据映射：
 *   row.port           → origin（起运港，如 LTA / QBA / TC2）
 *   group.mainlinePort → dest（目标港/干线港，如 BLCT3 / BLCTMS）
 *   group.containers   → slices（heavy / empty / danger 三类切片）
 *   group.count        → total（箱数）
 *   group.teu          → teu
 */
export function buildForceGroups(rows: PortMainlineRow[], origins: string[]): ForceGroup[] {
  const allTotals = rows.flatMap(r => r.groups.map(g => g.count))
  const maxTotal = Math.max(1, ...allTotals)

  const oSpacing = CANVAS_W / (origins.length + 1)

  return origins.map((origin, i) => {
    const row = rows.find(r => r.port === origin)
    const groups = row?.groups ?? []

    const nodes: DistributionNode[] = groups
      .slice() // 不修改原数组
      .sort((a, b) => b.count - a.count)
      .map(g => {
        const slices = buildSlices(g.containers)
        return {
          origin,
          dest: g.mainlinePort,
          key: `${origin}:${g.mainlinePort}`,
          total: g.count,
          teu: g.teu,
          slices,
          r: getRadius(g.count, maxTotal),
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          gcx: oSpacing * (i + 1),
          gcy: (TOP_Y + BOT_Y) / 2 + (GROUP_Y_OFFSETS[i] ?? 0),
          gIdx: i
        }
      })

    return { origin, cx: oSpacing * (i + 1), nodes }
  })
}

function buildSlices(containers: CargoTypeKey[]): TypeSlice[] {
  const counts: Record<CargoTypeKey, number> = { heavy: 0, empty: 0, danger: 0 }
  for (const c of containers) {
    counts[c] = (counts[c] ?? 0) + 1
  }
  return (['heavy', 'empty', 'danger'] as CargoTypeKey[])
    .filter(t => counts[t] > 0)
    .map(t => ({ t, v: counts[t] }))
}

// ─── 力模拟 ──────────────────────────────────────────────────────────────────

/**
 * 纯函数力布局：对所有节点施加弹力 + 碰撞排斥 + 边界约束。
 * 直接修改节点的 x / y 坐标（迭代完成后原地更新）。
 */
export function runForceLayout(groups: ForceGroup[]): DistributionNode[] {
  const all: DistributionNode[] = []

  // 初始化位置：以各组中心为基点，按角度散开
  for (const g of groups) {
    for (let i = 0; i < g.nodes.length; i++) {
      const n = g.nodes[i]
      const ang = (i / Math.max(1, g.nodes.length)) * Math.PI * 2 + 0.5
      const d = n.r * 1.5 + 25
      n.x = n.gcx + Math.cos(ang) * d
      n.y = n.gcy + Math.sin(ang) * d * 0.6
      n.vx = 0
      n.vy = 0
      all.push(n)
    }
  }

  const yMin = TOP_Y + 85
  const yMax = BOT_Y - 70
  const xMin = 70
  const xMax = CANVAS_W - 70

  for (let it = 0; it < FORCE_ITERATIONS; it++) {
    const alpha = Math.max(0.001, 1 - it / FORCE_ITERATIONS)

    // 1) 吸引到分组中心
    for (const n of all) {
      n.vx += (n.gcx - n.x) * 0.007 * alpha
      n.vy += (n.gcy - n.y) * 0.009 * alpha
    }

    // 2) 节点间碰撞排斥
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]
        const b = all[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.5
        const sameGroup = a.gIdx === b.gIdx
        const minD = a.r + b.r + (sameGroup ? INTRA_PAD : INTER_PAD)

        if (dist < minD) {
          const strength = sameGroup ? 0.35 : 0.55
          const f = ((minD - dist) / dist) * strength
          const fx = dx * f
          const fy = dy * f
          a.vx -= fx
          a.vy -= fy
          b.vx += fx
          b.vy += fy
        }

        // 远程组间排斥
        if (!sameGroup && dist < minD * 2.5) {
          const repel = 0.15 * alpha * (1 - dist / (minD * 2.5))
          const rx = (dx / dist) * repel * (a.r + b.r)
          const ry = (dy / dist) * repel * (a.r + b.r)
          a.vx -= rx
          a.vy -= ry
          b.vx += rx
          b.vy += ry
        }
      }
    }

    // 3) 边界约束
    for (const n of all) {
      if (n.y - n.r < yMin) n.vy += (yMin - (n.y - n.r)) * 0.12
      if (n.y + n.r > yMax) n.vy -= (n.y + n.r - yMax) * 0.12
      if (n.x - n.r < xMin) n.vx += (xMin - (n.x - n.r)) * 0.08
      if (n.x + n.r > xMax) n.vx -= (n.x + n.r - xMax) * 0.08
    }

    // 4) 阻尼 + 积分
    for (const n of all) {
      n.x += n.vx
      n.y += n.vy
      n.vx *= 0.55
      n.vy *= 0.55
    }
  }

  return all
}

// ─── 分组轮廓 hull ───────────────────────────────────────────────────────────

/**
 * 根据已完成力布局的节点列表，计算每个起运港的包围椭圆。
 */
export function buildGroupHulls(origins: string[], nodes: DistributionNode[]): GroupHull[] {
  const pad = 20
  return origins
    .map(origin => {
      const ns = nodes.filter(n => n.origin === origin)
      if (ns.length === 0) return null

      const xs = ns.flatMap(n => [n.x - n.r - pad, n.x + n.r + pad])
      const ys = ns.flatMap(n => [n.y - n.r - pad, n.y + n.r + pad])
      const l = Math.min(...xs)
      const r = Math.max(...xs)
      const t = Math.min(...ys)
      const b = Math.max(...ys)

      return {
        origin,
        cx: (l + r) / 2,
        cy: (t + b) / 2,
        rx: (r - l) / 2,
        ry: (b - t) / 2,
        top: t
      } satisfies GroupHull
    })
    .filter((h): h is GroupHull => h !== null)
}
