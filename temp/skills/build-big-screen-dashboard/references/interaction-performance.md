# Interaction and Performance

## Contents
- Shared state boundaries
- Redux interaction patterns
- Tooltip and brush behavior
- Real-time data updates
- Performance rules

## Shared state boundaries

Put state in Redux only if multiple widgets need to observe or mutate it.

Good Redux candidates:

- selected category or entity ID
- hovered item ID for coordinated highlighting
- time range
- brush extent
- global tooltip target metadata if centralized
- cached fetched datasets reused by multiple panels

Keep these outside Redux:

- DOM refs
- transition progress
- local animation frame IDs
- temporary geometry used only during one chart render

## Redux interaction patterns

Use a dedicated slice for dashboard-wide filters and coordination signals.

Typical shape:

```ts
interface DashboardFilterState {
  timeRange: [number, number] | null;
  selectedCategory: string | null;
  brushExtent: [number, number] | null;
  hoveredId: string | null;
}
```

Actions usually include:

- `setTimeRange`
- `setCategory`
- `setBrush`
- `setHover`
- `resetFilters`

Use memoized selectors for derived datasets. Filter and aggregate in selectors or pure transforms, not directly inside render bodies.

## Cross-view interaction patterns

Implement only the interactions the business actually needs.

Common mapping:

- Hover highlight: dispatch hovered ID and dim unrelated marks in sibling widgets.
- Click select: dispatch selected category or entity and let selectors derive the filtered datasets.
- Brush range: convert pixel selection back to domain values, then dispatch the extent.
- Time slider: dispatch a serialized range such as Unix ms timestamps.
- Drill-down: update route params or module-level query state, then switch data granularity.

## Tooltip behavior

Prefer a global tooltip portal when multiple widgets need consistent styling and z-index behavior.

Requirements:

- Render through `createPortal` to a top-level host.
- Separate hover state from tooltip presentation.
- Hide tooltip for empty or stale hover targets.
- Keep tooltip styling tokenized and readable on dark surfaces.

## Brush behavior

Use D3 brush on the chart layer, but convert the result into a serializable domain payload.

Rules:

- Clear the shared filter when `event.selection` is null.
- Convert pixel extents with `scale.invert`.
- Dispatch values in normalized form, usually timestamps or numeric min/max pairs.
- Keep brush event handlers free of expensive re-renders.

## Real-time data updates

Start with polling or one-shot fetch until the live update requirement is confirmed.

When WebSocket or push updates are required:

- Keep connection management centralized in a hook or service.
- Normalize incoming payloads before storing them.
- Apply incremental merges when possible instead of full dataset replacement.
- Throttle or batch very frequent updates before redrawing heavy charts.
- Provide disconnect and stale-data fallback states.

## Performance rules

### React layer

- Use `React.memo` for stable widgets.
- Subscribe with precise selectors to avoid unrelated rerenders.
- Avoid storing derived chart arrays in component state when they can be memoized.
- Lazy load heavy map or chart modules when they are not critical to first paint.

### Data layer

- Memoize filters and aggregates.
- Downsample dense series before drawing if the visual density exceeds useful resolution.
- Avoid repeatedly re-parsing timestamps and geojson inside render paths.

### Animation layer

- Use consistent transition timing such as enter `800ms`, update `600ms`, exit `400ms`.
- Use one easing family across the screen for coherence.
- Avoid React `setState` calls during D3 transitions.
- Disable or reduce motion for screens where refresh rate or hardware is constrained.

## D3 and Redux coordination guardrails

- Let Redux decide what data should be shown.
- Let D3 decide how the current data should animate and draw.
- Do not mirror the same transient visual state in both systems.
- Tear down listeners, intervals, animation frames, and sockets on unmount.
