---
name: component-integrator
description: "Integrate external component code into a project while preserving visual/functional output. Use whenever the user provides external component source code (copy-pasted, from another repo, prototype, or AI-generated) and wants it merged into an existing codebase following feature-based architecture. Triggers: 'integrate this component', 'add this view to the project', 'adapt this code to our codebase', 'make this fit our project structure', 'refactor this external code into our project', or when foreign code needs to conform to host conventions (file layout, naming, imports, state, styling, types). Also triggers when a large single-file component needs decomposition, or when D3/Three.js/Canvas visualization code must coexist with the project's React patterns. If provided component code clearly doesn't match the surrounding project structure, use this skill proactively."
---

# Component Integrator

Integrate external component code into a feature-based React/TypeScript project. The component's **rendered output must not change** — all modifications are internal: file structure, imports, type alignment, state wiring, styling conventions, and performance.

## When to use

- User provides component code from outside the current project (another repo, a prototype, AI-generated, copy-pasted snippet)
- User wants the code to conform to the host project's architecture, conventions, and tooling
- User has a large monolithic component that needs to be decomposed to fit the project's patterns

## Core principle

> **Output fidelity first.** Never change what the component renders, how it behaves, or what the user sees. All refactoring is behind the interface boundary.

---

## Phase 1 — Triage (do this BEFORE writing any code)

Before touching any code, build a complete picture. Incomplete information leads to broken integrations. Work through these checklists and **ask the user** whenever a gap can't be resolved by reading the codebase.

### 1.1 Read the host project

Understand the target environment before analyzing the incoming component.

```
Checklist — answer every item:
□ Architecture style (feature-based, pages-based, atomic, etc.)
□ Directory conventions (where do components, hooks, types, utils, styles live?)
□ Styling approach (CSS Modules, Tailwind, styled-components, CSS-in-JS)
□ State management (Redux slice location, Context patterns, Zustand stores)
□ Type conventions (shared types path, naming: *.types.ts vs types/index.ts)
□ Import alias (@/ or ~/? barrel exports?)
□ Linting / formatting (ESLint config, Prettier rules — run lint command to verify)
□ Key shared utilities the component might need (theme hooks, color resolvers, data fetchers)
```

Read the project's architecture doc if one exists (e.g., `docs/architecture.md`). Scan `src/shared/` or equivalent for reusable hooks and utilities that the incoming component should use instead of rolling its own.

### 1.2 Analyze the incoming component

Read the entire external code. Build a mental model:

```
Checklist — answer every item:
□ What does it render? (DOM structure, SVG, Canvas, WebGL)
□ What data does it consume? (props, fetched data, hardcoded data)
□ What state does it manage internally?
□ What external state does it read/write? (Redux, Context, URL params)
□ What third-party libraries does it use? Are they already in the host project?
□ What hooks does it call? Are any custom hooks missing from what the user provided?
□ What types/interfaces does it define or import?
□ What utility functions does it use? Are they inline or imported?
□ What styles does it use? (inline, CSS file, CSS Modules, Tailwind classes)
□ What events does it emit? (callbacks via props, custom events, Redux dispatches)
□ How large is it? (line count — determines if decomposition is needed)
```

### 1.3 Identify gaps — this is critical

Compare the two checklists. Flag every mismatch as one of:

| Gap type | Example | Resolution |
|----------|---------|------------|
| **Missing dependency** | Component uses `framer-motion` but host doesn't have it | Ask user: add dep or rewrite? |
| **Missing data context** | Component expects `bargeData` prop but no type definition given | Ask user for type or sample data |
| **Missing external state** | Component calls `useAppSelector(state => state.foo)` but slice doesn't exist | Ask user: create slice, pass as prop, or other? |
| **Missing hook/util** | Component imports `useCustomHook` that wasn't provided | Ask user to provide it |
| **Style conflict** | Component uses Tailwind but host uses CSS Modules | Rewrite styles (no need to ask) |
| **Type mismatch** | Component defines `PortData` but host has `PortLocation` with different shape | Reconcile — ask if semantics differ |
| **Library version conflict** | Component uses API from newer library version | Flag and resolve |

**If any gap of type "Missing data context", "Missing external state", or "Missing hook/util" exists, STOP and ask the user before proceeding.** These gaps cannot be resolved by guessing. Present them clearly with numbered items so the user can respond point by point.

Only proceed to Phase 2 when ALL critical gaps are resolved.

---

## Phase 2 — Plan the integration

With complete information, produce a concrete plan the user can approve or adjust before code is written.

### 2.1 Decide placement

Determine which feature module the component belongs to:

- Used by only one feature → place inside that feature's `components/` directory
- Generic UI primitive (Button, Modal, Chart wrapper) → place in `src/shared/components/`
- Cross-feature visualization → create a new feature module or place in the most relevant one

### 2.2 Plan the file structure

Map the monolithic component to the host project's conventions. Typical decomposition for a visualization component:

```
features/{feature-name}/components/{ComponentName}/
├── index.tsx                  # Main component (target ≤ 200 lines)
├── {ComponentName}.module.css # Styles matching project convention
├── types.ts                   # Component-scoped types
├── config.ts                  # Constants and configuration
├── hooks/
│   ├── use{DataHook}.ts       # Data fetching / transformation
│   └── use{InteractionHook}.ts
├── utils/
│   └── {transform}.ts         # Pure data transformation functions
└── renderers/                 # For D3/Canvas/WebGL components only
    ├── {PartA}Renderer.ts     # Imperative rendering, pure functions
    └── {PartB}Renderer.ts
```

Decomposition rules:
- **Main component ≤ 200 lines.** Extract logic into hooks, renderers, and utils when longer.
- **Renderers are pure functions** — take a DOM node + data + config, render imperatively, no React imports. This cleanly separates D3/Canvas from React lifecycle.
- **Hooks encapsulate state and effects.** One hook per concern.
- **Types are co-located** unless shared across features — then `shared/types/`.
- **Config holds magic numbers and style constants.** Extract from inline values.

### 2.3 Plan shared resource reuse

Check if the host project already provides:
- Data fetching hooks → use instead of raw `fetch` + `useState`
- Container size hooks (ResizeObserver) → use instead of inline ResizeObserver
- Color mapping utilities → use instead of component-local color logic
- Theme tokens → wire into `useTheme()` instead of hardcoded colors
- Typed store hooks (`useAppDispatch`, `useAppSelector`) → use the project's versions

### 2.4 Present the plan to the user

Show:
1. Target directory path
2. Planned file tree with brief per-file descriptions
3. Shared utilities that will be reused
4. New shared types/utils to create
5. Dependencies to install (if any)
6. Props interface — should be unchanged; flag if unavoidable changes exist

Wait for approval.

---

## Phase 3 — Execute the integration

### 3.1 Order of operations

Follow this sequence to keep the project buildable at every step:

1. **Install missing dependencies** (if approved)
2. **Create types** — shared and component-scoped
3. **Create utils and config** — pure functions, no React, easily testable
4. **Create hooks** — data, layout, interaction
5. **Create renderers** (if applicable) — D3/Canvas pure rendering functions
6. **Create the main component** — compose hooks and renderers
7. **Create/migrate styles** — convert to project's convention
8. **Wire into feature barrel export** (`index.ts`)
9. **Wire into page/route** that consumes it
10. **Run lint and type-check** — `pnpm lint && pnpm tsc --noEmit` (or project equivalent)

### 3.2 Code transformation rules

**Imports:**
- Replace relative cross-feature imports with barrel imports (`@/features/X` not deep paths)
- Replace duplicated utility code with `@/shared/` equivalents
- Use the project's import alias

**Types:**
- Same semantics as host type → use host's type
- New but reusable → `shared/types/`
- Component-only → co-locate in `types.ts`

**State management:**
- Replace local fetch patterns with the project's data fetching convention
- Global state → create or extend a slice in the appropriate location
- Evaluate Context vs Redux vs prop drilling based on project patterns

**Styling:**
- Convert to project's convention (CSS Modules, Tailwind, etc.)
- Replace hardcoded colors with theme tokens/CSS variables where appropriate
- Preserve every visual property — margins, paddings, fonts, colors, animations

**Performance (only where the original has clear issues):**
- `useMemo` for expensive computations with correct deps
- `useCallback` for callback props
- `React.memo` for pure child components with complex props
- For D3: preserve the original rendering strategy unless there's a visible perf problem

### 3.3 Output fidelity verification

After integration, verify:

```
□ Renders without console errors
□ Visual output matches original (layout, colors, typography, spacing)
□ Interactions work (hover, click, drag, zoom, tooltip)
□ Data flows correctly (props in, events out)
□ Responsive behavior unchanged
□ Animations/transitions preserved
□ Edge cases handled (empty data, loading, error states)
```

---

## Phase 4 — Report

```
✅ Integration complete: {ComponentName}

Location: src/features/{feature}/components/{ComponentName}/
Files created: {count}
Shared types added: {list or "none"}
Dependencies added: {list or "none"}
Shared utilities reused: {list}

Internal changes:
- {structural changes}
- {convention alignments}
- {performance improvements, if any}

Output fidelity: preserved — no visual or behavioral changes.
```

---

## Special cases

### D3 / imperative visualization components

Most common integration target. Key patterns:
- Extract `d3.select().append()...` chains into **renderer functions** in `renderers/`
- Renderer signature: `(container: SVGGElement, data: T, config: C, theme?: ThemeTokens) => void`
- Main component is a thin shell: `useRef` + `useEffect` calling renderers
- Tooltip/legend can remain as React JSX; bridge via `useState` for hover state

### Components with inline/hardcoded data

- Extract to a separate JSON file or typed constant
- Create a data-loading hook accepting either a file path or direct data prop
- Component works with both modes: `dataPath` prop OR `data` prop

### Map SDK components (AMap / Mapbox / Google Maps)

- Check if host has a shared map initialization hook
- If not, create one in `shared/lib/` or the relevant feature
- Handle API keys via environment variables, not inline

### Incomplete component code

This is the most important special case. If the user provides partial code:

1. **List every missing piece explicitly** with its file path or import statement
2. **Explain WHY each piece is needed** — not just that it's missing
3. **Suggest what it likely does** based on its usage in the provided code
4. **Ask the user to provide it**, or confirm your inference so you can create a compatible stub

Never silently invent implementations for missing business logic. Stubs are acceptable for obvious utility functions (e.g., `formatDate`), never for data transformations that affect the visual output.

---

## Integration decision flow

```
Read host project conventions
        │
        ▼
Read incoming component code fully
        │
        ▼
Critical gaps exist? ── Yes ──→ ASK USER, wait for answers
        │                              │
        No                     Answers received
        │                              │
        ▼                              │
Plan file structure  ◄─────────────────┘
and placement
        │
        ▼
Present plan to user
        │
        ▼
Approved? ── No ──→ Revise plan
        │
       Yes
        │
        ▼
Execute: types → utils → hooks → renderers → component → styles → wiring
        │
        ▼
Verify output fidelity
        │
        ▼
Report results
```
