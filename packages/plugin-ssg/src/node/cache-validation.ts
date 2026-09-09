import crypto from 'node:crypto'
import fs from 'fs-extra'
import { join } from 'node:path'

export interface SsgPageCacheItem {
  contentHash?: string
  loaderDataFilePath?: string
  assetHash?: string
}

export function getSsgSourceContentHash(
  sourceFile: string | undefined,
  fallbackHash: string,
): string {
  if (sourceFile) {
    try {
      const stat = fs.statSync(sourceFile)
      return `${stat.mtimeMs}:${stat.size}`
    } catch {
      // Fall through to the same global fallback used during rendering.
    }
  }
  return fallbackHash
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
