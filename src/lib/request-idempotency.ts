type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const DEFAULT_TTL_MS = 30_000

const inflight = new Map<string, Promise<unknown>>()
const recent = new Map<string, CacheEntry<unknown>>()

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const parts = keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
  return `{${parts.join(',')}}`
}

function nowMs(): number {
  return Date.now()
}

export function buildIdempotencyKey(namespace: string, payload: unknown): string {
  return `${namespace}:${stableStringify(payload)}`
}

export async function runIdempotent<T>(
  key: string,
  task: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<{ value: T; replayed: boolean }> {
  const now = nowMs()
  const cached = recent.get(key)
  if (cached && cached.expiresAt > now) {
    return { value: cached.value as T, replayed: true }
  }

  if (cached && cached.expiresAt <= now) {
    recent.delete(key)
  }

  const existing = inflight.get(key)
  if (existing) {
    const value = await existing as T
    return { value, replayed: true }
  }

  const promise = task()
  inflight.set(key, promise as Promise<unknown>)

  try {
    const value = await promise
    recent.set(key, {
      value,
      expiresAt: nowMs() + ttlMs,
    })
    return { value, replayed: false }
  } finally {
    inflight.delete(key)
  }
}

export function resetIdempotencyStateForTests(): void {
  inflight.clear()
  recent.clear()
}
