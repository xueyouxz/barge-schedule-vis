---
name: build-big-screen-dashboard
description: Design and implement large-screen visualization dashboards and digital-twin style data screens, especially React + Vite + TypeScript + D3 + Redux Toolkit systems. Use when Codex needs to scaffold, build, refactor, or review a dashboard/大屏可视化 project with 1920x1080 screen adaptation, grid layout, widget architecture, cross-view interactions, real-time data, map views, design tokens, or performance/a11y quality gates.
---

# Build Big Screen Dashboard

## Overview

Use this skill to turn dashboard requirements into a production-oriented implementation plan, code structure, and delivery checklist.
Default to a React + Vite + TypeScript + CSS Modules + Redux Toolkit + D3 subpackage stack unless the repository already uses a different stack.

## Workflow

1. Confirm the target stack, screen ratio, data sources, and whether the task is new implementation, extension, or review.
2. Establish the dashboard shell first: fixed design resolution, scale adaptation, grid regions, theme tokens, and shared panel/title primitives.
3. Split the screen into widgets with clear responsibilities: React owns lifecycle and state wiring, D3 owns SVG/canvas drawing and transitions.
4. Add cross-view state only for shared filters or coordination; keep transient animation and DOM state in refs, not in Redux.
5. Integrate data loading and real-time updates after layout and widget contracts are stable.
6. Validate performance, empty/error states, contrast, and responsiveness before considering the work complete.

## Default Decisions

- Use `1920x1080` as the default design coordinate system unless requirements state otherwise.
- Use a mixed adaptation strategy: root container `scale()` for global fidelity, CSS Grid/Flex for internal layout.
- Use D3 subpackages on demand; do not import the entire `d3` bundle.
- Use CSS Modules plus design tokens for all colors, spacing, radius, font size, and shadows.
- Use Redux Toolkit only for shared filters, brush ranges, hover IDs, selections, or other cross-widget state.
- Use `ResizeObserver`-based container measurement so widgets adapt to their grid slot.

## Choose References Deliberately

- Read `references/implementation-blueprint.md` when you need project structure, screen adaptation, layout, widget boundaries, or D3 integration patterns.
- Read `references/interaction-performance.md` when you need Redux linkage, hover/click/brush/tooltips, streaming updates, or performance constraints.
- Read `references/visual-map-quality.md` when you need theme tokens, panel/title patterns, map implementation choices, accessibility, or final QA checklists.

## Implementation Rules

- Establish shell and layout before implementing detailed chart behavior.
- Prefer small, composable widgets over monolithic dashboard files.
- Keep each widget self-contained: `index/component`, `hooks`, `types`, `style`, and `utils` only when justified.
- Memoize derived data with selectors; avoid repeated filtering inside render paths.
- Avoid calling React state setters during D3 transitions.
- Provide empty, loading, and error states for every data-driven panel.
- Preserve contrast and readability on dark backgrounds.
- If the repository already uses another charting or state solution, preserve existing conventions and adapt only the principles from this skill.

## Delivery Targets

- Produce a shell that can scale to the target screen and remain centered without overflow artifacts.
- Produce a layout contract with named regions and explicit widget ownership.
- Produce widget implementations that separate rendering, data transformation, and styling concerns.
- Produce shared state and selectors only where inter-widget coordination is required.
- Produce a concise acceptance checklist covering performance, resilience, and accessibility.

## Common Task Mapping

- “搭一个大屏首页框架” → Start with `references/implementation-blueprint.md`.
- “做多图表联动/刷选/Tooltip” → Load `references/interaction-performance.md`.
- “统一视觉风格/地图组件/验收规范” → Load `references/visual-map-quality.md`.
- “基于现有仓库改造性能和结构” → Load the blueprint first, then the performance reference.

## Output Expectations

- When asked to implement, create the minimal set of files needed for the target feature and stay consistent with the repository style.
- When asked to review, report gaps against the references as concrete action items.
- When requirements are ambiguous, clarify the minimum needed inputs: screen ratio, data mode, map usage, interaction depth, and refresh cadence.

## Resources

Use the three reference files in `references/` as the source of truth for implementation details. Keep the main skill lean and only load the reference that matches the current task.
