import crypto from 'node:crypto'
import fs from 'fs-extra'
import { join } from 'node:path'

export interface SsgPageCacheItem {
  contentHash?: string
  loaderDataFilePath?: string
  assetHash?: string
}

// Bump when the hash derivation changes so a pre-existing ssg-cache.json
// can never produce a false positive hit against current entries. Legacy
// entries simply miss once and are rewritten.
//
// v2 → v3: the zig-critters extractor no longer drops desktop media queries
// (escaped-quote selector parsing + no layout-selector exclusion + growing
// arena). Persisted HTML embeds the old poisoned inline critical CSS, so
// every cached page must re-render once.
const CONTENT_HASH_VERSION = 'v3'

/**
 * Content-hash a single source file: sha1 of the file bytes. Deliberately
 * independent of stat metadata — `git checkout`, branch switches and tooling
 * that rewrite mtimes must NOT invalidate the render cache; only real content
 * changes should.
 */
function hashSourceContent(sourceFile: string): string {
  const hasher = crypto.createHash('sha1')
  hasher.update(CONTENT_HASH_VERSION)
  hasher.update('\0')
  hasher.update(fs.readFileSync(sourceFile) as Uint8Array)
  return hasher.digest('hex')
}

/**
 * Per-route render-cache identity: the source file's content hash. Routes
 * without a source file (synthetic base routes such as /docs) use the
 * `fallbackHash` (client bundle identity), which is exactly the
 * invalidation those routes need.
 *
 * Cost: one small-file read per route (~259 files ≈ tens of milliseconds,
 * shared source files read once per route). Replaces the old
 * `mtimeMs:size` identity whose mtime half re-rendered the entire site
 * after every `git checkout` (231.8s observed).
 */
export function getSsgSourceContentHash(
  sourceFile: string | undefined,
  fallbackHash: string,
): string {
  if (sourceFile) {
    try {
      return hashSourceContent(sourceFile)
    } catch {
      // Unreadable file → fall through to the caller's fallback. Degrading
      // to the global identity over-invalidates (safe direction) instead of
      // serving stale pages.
    }
  }
  return fallbackHash
}

/**
 * Synchronous variant for bulk pre-computation during build setup. Returns
 * the real sha1 content hash, or `legacyFallback` when the file cannot be
 * read so callers keep their previous identity instead of collapsing onto
 * the shared global fallback.
 */
export function hashSourceFileContentSync(
  sourceFile: string,
  legacyFallback: string,
): string {
  try {
    return hashSourceContent(sourceFile)
  } catch {
    return legacyFallback
  }
}

export function isSsgPageCacheValid({
  routePath,
  cacheItem,
  sourceContentHash,
  expectedAssetHash,
  ssgPagesDir,
  requireAssetHash = false,
}: {
  routePath: string
  cacheItem: SsgPageCacheItem | undefined
  sourceContentHash: string
  expectedAssetHash?: string
  ssgPagesDir: string
  requireAssetHash?: boolean
}): boolean {
  if (!cacheItem || cacheItem.contentHash !== sourceContentHash) return false
  if (requireAssetHash && !cacheItem.assetHash) return false
  if (
    expectedAssetHash !== undefined &&
    cacheItem.assetHash !== expectedAssetHash
  ) {
    return false
  }

  const pathHash = crypto.createHash('md5').update(routePath).digest('hex')
  if (!fs.existsSync(join(ssgPagesDir, `${pathHash}.html`))) return false

  if (
    cacheItem.loaderDataFilePath &&
    !fs.existsSync(join(ssgPagesDir, `${pathHash}.json`))
  ) {
    return false
  }

  return true
}
