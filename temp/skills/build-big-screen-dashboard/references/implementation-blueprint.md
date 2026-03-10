# Implementation Blueprint

## Contents
- Default stack and architecture
- Screen adaptation and shell
- Grid layout rules
- Widget design pattern
- Project structure guidance

## Default stack and architecture

- Use `Vite + React + TypeScript` as the baseline.
- Use `CSS Modules` for local styles and token consumption.
- Use `Redux Toolkit` for shared state only.
- Use D3 subpackages such as `d3-selection`, `d3-scale`, `d3-axis`, `d3-shape`, `d3-transition`, `d3-brush`, `d3-geo`, and `d3-geo-projection` as needed.
- Avoid `import * as d3 from 'd3'`.

## Vite and bundling guidance

- Split D3 by capability to keep the entry chunk small.
- Prebundle frequently used D3 subpackages when startup cost matters.
- Keep chunk warnings strict enough to surface accidental all-in imports.

Preferred chunk split themes:

- `d3-core`: selection, transition, scale, axis
- `d3-geo`: geo, geo-projection, topojson-client
- `d3-shape`: shape, hierarchy
- `react-vendor`: react, react-dom
- `redux-vendor`: redux toolkit, react-redux

## Screen adaptation and shell

Default to a hybrid strategy:

1. Use a fixed design board such as `1920x1080`.
2. Compute a uniform `scale = min(windowWidth/designWidth, windowHeight/designHeight)`.
3. Translate the board to center it inside the viewport.
4. Keep internal layout responsive with Grid/Flex inside the scaled board.

Implementation requirements:

- Set the viewport container to `100vw/100vh` with `overflow: hidden`.
- Apply `transform: translate(...) scale(...)` on the board root.
- Use `transform-origin: 0 0`.
- Recompute on window resize.
- Prefer short-edge fit unless the product explicitly wants edge fill or cropping.

## Grid layout rules

- Define top-level regions with named `grid-template-areas`.
- Keep the main grid semantic: `header`, `left`, `center`, `right`, `bottom` or equivalent domain names.
- Nest secondary Grid or Flex containers inside side panels instead of flattening all widgets into one huge grid.
- Keep spacing, padding, and panel heights tokenized.

Recommended layout responsibilities:

- Shell: viewport, scaling, centering
- Grid: macro regions and spacing
- Panel: card chrome, title, content slots
- Widget: rendering and data behavior

## Widget design pattern

Use the React/D3 separation strictly:

- React owns data fetching orchestration, props, refs, lifecycle, and conditional states.
- D3 owns selections, joins, geometry, axes, transitions, and brush behavior.

Recommended widget contract:

- `index.tsx` or `Widget.tsx`: component entry and state wiring
- `hooks/useWidgetData.ts`: fetch or derive business data
- `hooks/useWidgetChart.ts`: D3 binding logic when needed
- `types.ts`: view-level types only
- `utils/transform.ts`: pure transforms for chart-ready data
- `style/index.module.css`: container and local styles

## Container sizing

Do not hardcode widget width or height. Use a `ResizeObserver` hook.

Minimum behavior:

- Attach a ref to the widget container.
- Observe content rect width and height.
- Round values before rendering to reduce noisy updates.
- Return `[containerRef, { width, height }]`.

Guardrails:

- Do not render expensive charts until width and height are both positive.
- Disconnect the observer on unmount.

## Widget quality contract

Every widget should support these baseline states:

- `loading`
- `empty`
- `error`
- `ready`

Every widget should also follow these display rules:

- Show a title area with icon and title text when the dashboard pattern uses framed panels.
- Consume shared palette and font tokens instead of hardcoded colors.
- Preserve text contrast on dark backgrounds.
- Wrap heavy components with `React.memo` when props are stable.

## Project structure guidance

Use a structure close to this when creating a new dashboard module:

```text
src/
  app/
  pages/
    Dashboard/
      index.tsx
      style/index.module.css
      components/
        DashboardShell/
        DashboardGrid/
        Panel/
      widgets/
        WidgetA/
        WidgetB/
  hooks/
    useContainerSize.ts
  store/
    index.ts
    hooks.ts
    dashboardFilterSlice.ts
    selectors.ts
  theme/
    tokens.ts
```

When working inside an existing repository, adapt this structure to the local conventions instead of forcing a migration.
