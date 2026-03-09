# D3 + React Integration Patterns

Reference for integrating D3 visualization components into a React project. This covers the most common scenario encountered by the component-integrator skill.

## The renderer pattern

Separate D3 imperative code from React state management:

```
React component (state + lifecycle)
  │
  ├── useEffect → calls renderer functions (D3, pure)
  │
  └── JSX → Tooltip, Legend, Controls (React, declarative)
```

### Renderer function signature

```typescript
// renderers/TimeAxisRenderer.ts
import * as d3 from 'd3'
import type { ThemeTokens } from '@/shared/lib/theme'

interface TimeAxisConfig {
  margin: { top: number; left: number }
  height: number
}

export function renderTimeAxis(
  container: SVGGElement,
  timeScale: d3.ScaleTime<number, number>,
  config: TimeAxisConfig,
  theme: ThemeTokens['chart']
): void {
  const g = d3.select(container)
    .selectAll<SVGGElement, null>('.time-axis')
    .data([null])
    .join('g')
    .attr('class', 'time-axis')
    .attr('transform', `translate(${config.margin.left}, ${config.margin.top})`)

  // ... D3 rendering logic
}
```

Key properties:
- Pure function, no React imports
- Takes an SVG/HTML container node as first argument
- Accepts theme tokens for consistent coloring
- Returns void (side effects on the DOM)
- Uses D3 join pattern (`selectAll().data().join()`) for idempotent updates

### Main component structure

```tsx
// index.tsx
export default function MyVisualization({ width, height, dataPath }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { tokens } = useTheme()

  // Hooks for data, layout, interaction
  const { data, loading } = useDataHook(dataPath)
  const layout = useLayoutHook(data, width, height)
  const { hovered, handlers } = useInteractionHook()

  // D3 rendering (delegated to pure renderer functions)
  useEffect(() => {
    if (!svgRef.current || !layout) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')
    renderPartA(g.node()!, layout.partA, tokens.chart)
    renderPartB(g.node()!, layout.partB, handlers, tokens.chart)
  }, [layout, tokens, handlers])

  if (loading) return <LoadingIndicator />

  return (
    <div className={styles.container}>
      <svg ref={svgRef} width={width} height={height} />
      {hovered && <Tooltip data={hovered} />}
    </div>
  )
}
```

## Hook patterns

### Data loading hook

```typescript
// hooks/useMyData.ts
export function useMyData(path: string | null, directData?: MyData[]) {
  const [data, setData] = useState<MyData[] | null>(directData ?? null)
  const [loading, setLoading] = useState(!directData)

  useEffect(() => {
    if (directData || !path) return
    const controller = new AbortController()
    setLoading(true)

    fetch(path, { signal: controller.signal })
      .then(res => res.json())
      .then(setData)
      .catch(err => { if (err.name !== 'AbortError') console.error(err) })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [path, directData])

  return { data, loading }
}
```

### Layout computation hook

```typescript
// hooks/useLayout.ts
export function useLayout(data: MyData[] | null, width: number, height: number) {
  return useMemo(() => {
    if (!data) return null
    // Expensive layout computation
    const timeScale = d3.scaleTime().domain(...).range(...)
    const rows = computeRows(data, height)
    return { timeScale, rows }
  }, [data, width, height])
}
```

### Interaction hook

```typescript
// hooks/useInteraction.ts
export function useInteraction(onExternalClick?: (data: ClickData) => void) {
  const [hovered, setHovered] = useState<HoverData | null>(null)

  const handlers = useCallback(() => ({
    onMouseEnter: (d: HoverData) => setHovered(d),
    onMouseLeave: () => setHovered(null),
    onClick: (d: ClickData) => onExternalClick?.(d),
  }), [onExternalClick])

  return { hovered, handlers: handlers() }
}
```

## Common pitfalls when integrating D3 components

1. **Don't mix D3 DOM manipulation with React rendering** in the same DOM subtree. Use a ref boundary.
2. **Clean up D3 selections** in the useEffect cleanup or at the start of each render cycle.
3. **Don't forget to forward theme tokens** to renderers — hardcoded colors break theme switching.
4. **ResizeObserver cleanup** — always disconnect the observer and cancel any pending rAF in the effect cleanup.
5. **AbortController for fetch** — always abort in-flight requests when the component unmounts or dependencies change.
