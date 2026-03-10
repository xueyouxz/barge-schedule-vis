export function parseTeu(value?: string): number {
  if (!value) return 0

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function extractRouteChain(route?: string): string[] {
  const raw = (route || '').trim()
  if (!raw) return []

  const tokenMatches = Array.from(raw.matchAll(/'([^']+)'/g))
    .map(match => match[1]?.trim())
    .filter(Boolean) as string[]
  if (tokenMatches.length < 2) return []

  const chain: string[] = []
  tokenMatches.forEach(token => {
    if (chain.length === 0 || chain[chain.length - 1] !== token) {
      chain.push(token)
    }
  })

  return chain
}
