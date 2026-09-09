import crypto from 'node:crypto'
import { parseFrontmatterAsync } from '../utils'
import {
  docCache,
  type RouteCacheContext,
  type RouteCacheVariant,
} from '../routes/cache'

const legacyFrontmatterHashes = new Map<string, string>()

function hashFrontmatterData(data: Record<string, unknown>): string {
  const { lastUpdated: _, ...rest } = data
  return crypto.createHash('md5').update(JSON.stringify(rest)).digest('hex')
}

export async function computeFrontmatterHash(
  filePath: string,
): Promise<string> {
  try {
    const { data } = await parseFrontmatterAsync(filePath)
    return hashFrontmatterData(data)
  } catch {
    return ''
  }
}

export function getFrontmatterHash(
  filePath: string,
  context?: RouteCacheContext,
  variant?: RouteCacheVariant,
): string | undefined {
  const hashes =
    variant?.frontmatterHashes ??
    context?.frontmatterHashes ??
    legacyFrontmatterHashes
  let hash = hashes.get(filePath)
  if (hash === undefined) {
    const cache = variant?.docCache ?? context?.docCache ?? docCache
    const cachedDoc = cache.getStale(filePath)
    if (cachedDoc?.route?.frontmatter) {
      hash = hashFrontmatterData(cachedDoc.route.frontmatter)
      hashes.set(filePath, hash)
    }
  }
  return hash
}

export function setFrontmatterHash(
  filePath: string,
  hash: string,
  context?: RouteCacheContext,
  variant?: RouteCacheVariant,
): void {
  ;(
    variant?.frontmatterHashes ??
    context?.frontmatterHashes ??
    legacyFrontmatterHashes
  ).set(filePath, hash)
}

export function removeFrontmatterHash(
  filePath: string,
  context?: RouteCacheContext,
  variant?: RouteCacheVariant,
): void {
  ;(
    variant?.frontmatterHashes ??
    context?.frontmatterHashes ??
    legacyFrontmatterHashes
  ).delete(filePath)
}
