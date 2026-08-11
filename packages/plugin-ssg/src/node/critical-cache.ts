import crypto from 'node:crypto'

export type CriticalCssEngine = 'zig-critters' | 'beasties'

/**
 * Build a cache key from the selectors/classes present in the rendered page
 * and the exact stylesheet. Text content is ignored because it does not affect
 * CSS selector coverage; attributes and element structure are preserved.
 */
export function createCriticalCssCacheKey(
  html: string,
  css: string,
  engine: CriticalCssEngine,
): string {
  const structuralHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>([^<]+)</g, '><')
    .replace(/\s+/g, ' ')
    .trim()

  return crypto
    .createHash('sha256')
    .update(engine)
    .update('\0')
    .update(structuralHtml)
    .update('\0')
    .update(css)
    .digest('hex')
}

function getStyleTags(html: string): string[] {
  return html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []
}

/**
 * Return only style tags that were added by an engine. This prevents the
 * Beasties fallback from caching and reinjecting styles that were already
 * present in the SSR template or emitted by a component.
 */
export function extractNewStyleTags(
  before: string,
  after: string,
): string | null {
  const existing = new Set(getStyleTags(before))
  const added = getStyleTags(after).filter((tag) => !existing.has(tag))
  return added.length > 0 ? added.join('\n') : null
}

type CacheEntry = {
  promise: Promise<string | null>
  settled: boolean
}

/**
 * Deduplicates concurrent extraction for identical page shapes while keeping
 * failures retryable. The cache is intentionally build-scoped and bounded so
 * large sites do not retain every rendered page indefinitely.
 */
export class CriticalCssCache {
  private readonly entries = new Map<string, CacheEntry>()

  constructor(private readonly maxEntries = 512) {}

  getOrCreate(
    key: string,
    extract: () => Promise<string | null> | string | null,
  ): Promise<string | null> {
    const existing = this.entries.get(key)
    if (existing) return existing.promise

    const entry: CacheEntry = {
      promise: Promise.resolve(null),
      settled: false,
    }
    const pending = Promise.resolve()
      .then(extract)
      .catch((error) => {
        this.entries.delete(key)
        throw error
      })
      .finally(() => {
        entry.settled = true
        this.evictSettledEntries()
      })
    entry.promise = pending
    this.entries.set(key, entry)

    this.evictSettledEntries()
    return pending
  }

  get size(): number {
    return this.entries.size
  }

  private evictSettledEntries(): void {
    while (this.entries.size > this.maxEntries) {
      let evicted = false
      for (const [key, entry] of this.entries) {
        if (!entry.settled) continue
        this.entries.delete(key)
        evicted = true
        break
      }
      if (!evicted) return
    }
  }
}
