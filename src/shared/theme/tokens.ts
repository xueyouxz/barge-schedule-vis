import type { ThemeTokens } from './theme.types'

export const themeTokens: ThemeTokens = {
  color: {
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    surfaceStrong: 'var(--color-surface-strong)',
    shellBackground: 'var(--color-shell-background)',
    shellGlowPrimary: 'var(--color-shell-glow-primary)',
    shellGlowSecondary: 'var(--color-shell-glow-secondary)',
    text: 'var(--color-text)',
    muted: 'var(--color-muted)',
    accent: 'var(--color-accent)',
    border: 'var(--color-border)'
  },
  chart: {
    background: 'var(--chart-background)',
    surface: 'var(--chart-surface)',
    border: 'var(--chart-border)',
    text: 'var(--chart-text)',
    textMuted: 'var(--chart-text-muted)',
    textSecondary: 'var(--chart-text-secondary)',
    grid: 'var(--chart-grid)',
    dayBandEven: 'var(--chart-day-band-even)',
    dayBandOdd: 'var(--chart-day-band-odd)',
    gridLineColor: 'var(--chart-grid-line-color)',
    axisLabelColor: 'var(--chart-axis-label-color)',
    rowBackgroundEven: 'var(--chart-row-background-even)',
    rowBackgroundOdd: 'var(--chart-row-background-odd)',
    sail: 'var(--chart-sail)',
    load: 'var(--chart-load)',
    unload: 'var(--chart-unload)',
    transship: 'var(--chart-transship)',
    cargoBig: 'var(--chart-cargo-big)',
    cargoNormal: 'var(--chart-cargo-normal)',
    cargoDanger: 'var(--chart-cargo-danger)',
    portBandFallback: 'var(--chart-port-band-fallback)',
    loadGradientTop: 'var(--chart-load-gradient-top)',
    loadGradientBottom: 'var(--chart-load-gradient-bottom)',
    unloadGradientTop: 'var(--chart-unload-gradient-top)',
    unloadGradientBottom: 'var(--chart-unload-gradient-bottom)'
  }
}

export const DEFAULT_THEME_MODE = 'light' as const
export const THEME_STORAGE_KEY = 'barge-schedule-vis.theme'
