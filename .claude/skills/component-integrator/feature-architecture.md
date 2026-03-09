# Feature-Based Architecture Reference

This reference describes the conventions of a host project following the `vibe-coding-frontend-template` architecture. Read this when integrating components into such a project.

## Directory structure

```
src/
├── app/                    # App bootstrap: main.tsx, App.tsx, providers.tsx, routes.tsx
├── features/               # Business modules grouped by domain
│   └── {feature-name}/
│       ├── components/     # Feature-scoped React components
│       ├── hooks/          # Feature-scoped custom hooks
│       ├── types/          # Feature-scoped TypeScript types
│       ├── api/            # Feature-scoped API calls
│       ├── utils/          # Feature-scoped pure utility functions
│       └── index.ts        # Barrel export (public API of the feature)
├── shared/                 # Cross-feature primitives
│   ├── lib/                # Store config, typed hooks, shared utilities
│   ├── types/              # Truly global types (API response, domain entities)
│   ├── constants/          # App-wide constants (palettes, config)
│   ├── utils/              # Cross-feature utility functions
│   └── store/              # Global Redux slices
├── layouts/                # Route shell components (Header, Sidebar, etc.)
│   └── components/
├── styles/                 # Global CSS variables and resets
└── assets/                 # Images, fonts, icons
```

## Dependency direction

```
shared (independent) → features (may depend on shared) → app (composes features + layouts)
```

- `shared/` must not import from `features/` or `app/`
- `features/` may import from `shared/` and from other features' barrel exports (`index.ts`), never from their internal paths
- `app/` composes everything

## Conventions

### File naming
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` (e.g., `useBargeData.ts`)
- Types: `{name}.types.ts` or `types.ts` (co-located)
- Utils: `camelCase.ts`
- Styles: `{ComponentName}.module.css` or `index.module.css`
- Config: `config.ts`

### Styling
- CSS Modules (`.module.css`) as default
- CSS custom properties for theming (`var(--color-bg)`, etc.)
- Theme tokens available via `useTheme()` hook for JS-level access (D3, SVG)
- No inline styles except for truly dynamic computed values

### State management
- Redux Toolkit with typed hooks
- `useAppDispatch` and `useAppSelector` from `shared/lib/hooks.ts`
- Feature-specific slices live in `features/{name}/store/` unless truly global
- Global slices (color mapping, user prefs) live in `shared/store/`

### Routing
- Lazy loading via `React.lazy()` + `Suspense`
- Routes defined in `app/routes.tsx`
- Layout shells via `<Outlet />`

### Barrel exports
- Every feature has an `index.ts` that exports its public API
- Other features import from the barrel, never from internal paths
- Example: `import { BargeCargoGanttView } from '@/features/barge-visualization'`

### TypeScript
- Strict mode enabled
- Prefer `interface` for object shapes, `type` for unions/intersections
- Export types alongside the code that uses them
- Avoid `any` — use `unknown` with type narrowing when needed
