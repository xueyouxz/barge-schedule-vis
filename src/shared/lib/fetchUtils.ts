import { csvParse } from 'd3'

async function ensureOk(response: Response, resource: string) {
  if (!response.ok) {
    throw new Error(`加载失败: ${resource} (${response.status})`)
  }
}

export async function fetchJson<T>(resource: string): Promise<T> {
  const response = await fetch(resource)
  await ensureOk(response, resource)
  return (await response.json()) as T
}

export async function fetchJsonOptional<T>(resource: string): Promise<T | null> {
  try {
    const response = await fetch(resource)
    if (!response.ok) {
      return null
    }

    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function fetchCsvRows<T extends object>(resource: string): Promise<T[]> {
  const response = await fetch(resource)
  await ensureOk(response, resource)
  const text = await response.text()
  return csvParse(text) as unknown as T[]
}
