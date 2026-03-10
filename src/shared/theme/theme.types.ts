export type ThemeMode = 'light' | 'dark' | 'system'

export type ResolvedTheme = Exclude<ThemeMode, 'system'>

export interface ThemeTokens {
  color: {
    background: string
    surface: string
    surfaceStrong: string
    shellBackground: string
    shellGlowPrimary: string
    shellGlowSecondary: string
    text: string
    muted: string
    accent: string
    border: string
  }
  chart: {
    background: string
    surface: string
    border: string
    text: string
    textMuted: string
    textSecondary: string
    grid: string
    dayBandEven: string
    dayBandOdd: string
    gridLineColor: string
    axisLabelColor: string
    rowBackgroundEven: string
    rowBackgroundOdd: string
    sail: string
    load: string
    unload: string
    transship: string
    cargoBig: string
    cargoNormal: string
    cargoDanger: string
    portBandFallback: string
    loadGradientTop: string
    loadGradientBottom: string
    unloadGradientTop: string
    unloadGradientBottom: string
  }
}

export interface ThemeContextValue {
  mode: ThemeMode
  theme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  tokens: ThemeTokens
}
