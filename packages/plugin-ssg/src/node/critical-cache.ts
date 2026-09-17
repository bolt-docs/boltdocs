import crypto from 'node:crypto'
import fs from 'fs-extra'
import { join } from 'node:path'

export type CriticalCssEngine = 'zig-critters' | 'beasties'

/**
 * Build a cache key from the selectors/classes present in the rendered page
 * and the exact stylesheet. Text content is ignored because it does not affect
 * CSS selector coverage; attributes and element structure are preserved.
 *
 * `cssHash` is the pre-computed sha256 digest of `css`. Builds pass the same
 * stylesheet for every page, so hashing it once per build instead of once per
 * page removes a repeated O(cssLength) hash from the hot path. A Buffer
 * digest is intentional: `hash.update()` accepts it directly and copying a
 * 32-byte digest is cheaper than re-hashing a ~200KB stylesheet.
 */
export function createCriticalCssCacheKey(
  html: string,
  cssHash: crypto.BinaryLike,
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
    .update(cssHash || css)
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

/** On-disk layout of one extracted critical-CSS payload. */
interface DiskCachePayload {
  /** Format version — bump invalidates every persisted entry. */
  v: 1
  /** Engine that produced the payload (validated on read). */
  engine: CriticalCssEngine
  /** Inline `<style>` block, or null when extraction produced nothing. */
  style: string | null
}

const DISK_CACHE_VERSION = 1
/** Upper bound for a single persisted payload — protects the cache dir. */
const MAX_DISK_PAYLOAD_BYTES = 256 * 1024

/**
 * Deduplicates concurrent extraction for identical page shapes while keeping
 * failures retryable. Entries are shared across the process; failures delete
 * their entry so a later attempt can retry.
 *
 * When a `cacheDir` is provided, a persistent L2 layer backs the in-memory
 * map: payloads are keyed by the same structural hash, so a rebuild that
 * changes page text (but not layout) reuses the previous extraction instead
 * of paying the ~1s WASM pass again. Read misses fall through to extraction;
 * successful extractions are written asynchronously (never blocking render).
 */
export class CriticalCssCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly cacheDir?: string
  private readonly maxEntries: number

  constructor(options: { cacheDir?: string; maxEntries?: number } = {}) {
    this.cacheDir = options.cacheDir
    // Large sites can have more distinct page shapes than routes; keep the
    // in-memory window generous while staying bounded.
    this.maxEntries = options.maxEntries ?? 1024
  }

  getOrCreate(
    key: string,
    extract: () => Promise<string | null> | string | null,
    options: { engine?: CriticalCssEngine } = {},
  ): Promise<string | null> {
    const existing = this.entries.get(key)
    if (existing) return existing.promise

    const engine = options.engine ?? 'zig-critters'
    const entry: CacheEntry = {
      promise: Promise.resolve(null),
      settled: false,
    }
    const pending = Promise.resolve()
      .then(async () => {
        if (this.cacheDir) {
          const diskHit = await this.readDisk(key, engine)
          if (diskHit !== undefined) return diskHit
        }
        return extract()
      })
      .then((result) => {
        if (this.cacheDir) {
          // Fire-and-forget: a write failure must never fail a page.
          void this.writeDisk(key, engine, result).catch(() => {})
        }
        return result
      })
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

  private diskPath(key: string): string {
    return join(this.cacheDir!, `critical-css-${key}.json`)
  }

  /** Returns `undefined` on any miss (including unreadable/invalid files). */
  private async readDisk(
    key: string,
    engine: CriticalCssEngine,
  ): Promise<string | null | undefined> {
    try {
      const raw = await fs.readFile(this.diskPath(key), 'utf-8')
      const payload = JSON.parse(raw) as DiskCachePayload
      if (
        payload?.v !== DISK_CACHE_VERSION ||
        payload?.engine !== engine ||
        !(payload.style === null || typeof payload.style === 'string')
      ) {
        return undefined
      }
      // Touch the file so TTL-based pruning measures last reuse, not last
      // write. Best-effort: relighting atime is an optimization for the
      // garbage collector, not a correctness requirement.
      const now = new Date()
      void fs.utimes(this.diskPath(key), now, now).catch(() => {})
      return payload.style
    } catch {
      return undefined
    }
  }

  private async writeDisk(
    key: string,
    engine: CriticalCssEngine,
    style: string | null,
  ): Promise<void> {
    if (!this.cacheDir) return
    if (style !== null && style.length > MAX_DISK_PAYLOAD_BYTES) return
    const payload: DiskCachePayload = {
      v: DISK_CACHE_VERSION,
      engine,
      style,
    }
    await fs.ensureDir(this.cacheDir)
    await fs.writeFile(this.diskPath(key), JSON.stringify(payload), 'utf-8')
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

/**
 * Garbage-collect persisted critical-CSS payloads. Two policies, both
 * best-effort (any failure is swallowed — the cache is advisory):
 * - TTL: files not touched within `maxAgeMs` are removed. Page shapes churn
 *   as content evolves; stale payloads are exactly the ones no longer hit.
 * - Cap: when the directory holds more than `maxEntries` payloads, the
 *   oldest beyond the cap are removed so a huge site cannot grow it forever.
 *
 * The `atime`/`mtime` pair is refreshed on every cache hit, so a payload that
 * keeps being reused never looks stale.
 */
export async function pruneCriticalCssDiskCache(
  cacheDir: string,
  options: { maxAgeMs?: number; maxEntries?: number } = {},
): Promise<number> {
  const maxAgeMs = options.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000
  const maxEntries = options.maxEntries ?? 5000
  try {
    if (!fs.existsSync(cacheDir)) return 0
    const cutoff = Date.now() - maxAgeMs
    const aged: Array<{ file: string; usedAt: number }> = []
    for (const file of await fs.readdir(cacheDir)) {
      if (!file.startsWith('critical-css-') || !file.endsWith('.json')) continue
      const fullPath = join(cacheDir, file)
      try {
        const stat = await fs.stat(fullPath)
        const usedAt = Math.max(stat.mtimeMs, stat.atimeMs)
        if (usedAt < cutoff) {
          await fs.remove(fullPath)
          aged.push({ file, usedAt: 0 })
        } else {
          aged.push({ file, usedAt })
        }
      } catch {
        // Unreadable entry — leave it for the next pass.
      }
    }
    let pruned = aged.filter((e) => e.usedAt === 0).length
    if (aged.length > maxEntries) {
      const survivors = aged
        .filter((e) => e.usedAt > 0)
        .sort((a, b) => b.usedAt - a.usedAt)
      for (const entry of survivors.slice(maxEntries)) {
        try {
          await fs.remove(join(cacheDir, entry.file))
          pruned++
        } catch {
          // Ignore individual removal failures.
        }
      }
    }
    return pruned
  } catch {
    return 0
  }
}
