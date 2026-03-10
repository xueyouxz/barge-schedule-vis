# Visual, Map, and Quality Reference

## Contents
- Theme token rules
- Palette and panel guidance
- Title component pattern
- Map implementation choices
- Accessibility and resilience
- Acceptance checklist

## Theme token rules

Centralize all visual primitives in tokens.

Minimum token groups:

- colors: background, panel, border, text, emphasis, success, warning, danger
- chart palette: categorical series colors and sequential ramps
- typography: title, panel title, metric, body, caption
- spacing: panel padding, grid gap, internal stack gap
- radius and shadow

Do not hardcode colors inside widgets except for temporary experiments.

## Palette and panel guidance

- Use a dark canvas as the default only if the product truly targets large-screen display scenarios.
- Keep text and axis strokes above accessible contrast thresholds.
- Reuse one panel shell across the dashboard instead of re-inventing borders per widget.
- Keep decorative borders and glow effects lighter than the data marks so visuals remain data-first.

## Title component pattern

Use a shared title component when the dashboard repeats icon + title blocks.

Title component responsibilities:

- render optional icon
- render heading text
- accept actions or right-side summary slot when needed
- consume tokenized font size, spacing, and accent line styles

## Map implementation choices

Pick the map approach based on interaction depth.

- Use D3 geo rendering for thematic maps, custom projections, choropleths, or strong SVG integration.
- Use Mapbox GL or a tile engine when continuous pan/zoom, 3D, or large vector tile interaction is central.
- Use simplified topojson/geojson assets for large screens; reduce geometry precision when full fidelity is unnecessary.

Map rules:

- Cache parsed geographic data.
- Keep projection setup stable between renders.
- Separate base map rendering from overlay data layers.
- Avoid reprojecting unchanged geometry on every interaction.

## Accessibility and resilience

Large screens still need accessibility and fault tolerance.

Required checks:

- provide text alternatives or visible labels for critical metrics
- ensure keyboard or non-hover fallback when the screen is not strictly TV-only
- provide empty and error states instead of blank panels
- guard against API timeout, malformed data, and missing fields
- avoid relying on color alone to distinguish important states

## Acceptance checklist

Use this checklist before handoff:

- Shell scales correctly and remains centered across the target resolutions.
- Grid regions align with the information hierarchy.
- Widgets render loading, empty, error, and ready states.
- Shared interactions update sibling widgets without unnecessary rerenders.
- Heavy charts and maps avoid full redraws on minor state changes.
- Real-time updates do not cause visible flicker or memory leaks.
- Theme tokens cover the whole screen consistently.
- Text, lines, and highlights remain readable on the target display.
- Map layers or geo views use appropriate simplification and caching.
- Event listeners, observers, intervals, and sockets are cleaned up.
