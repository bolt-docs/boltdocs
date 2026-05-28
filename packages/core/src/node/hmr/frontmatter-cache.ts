import crypto from 'node:crypto'
import { parseFrontmatterAsync } from '../utils'
import { docCache } from '../routes/cache'

/**
 * In-memory cache for frontmatter hashes.
 * Used to quickly detect if a file's frontmatter (which affects routing/sidebar)
 * changed, vs. only its body content changing (which doesn't affect structure).
 */
const frontmatterHashes = new Map<string, string>()

/**
 * Computes a fast hash of only the frontmatter section of a file.
 * Excludes the dynamic `lastUpdated` property to avoid HMR hash mismatches.
 */
export async function computeFrontmatterHash(
  filePath: string,
): Promise<string> {
  try {
    const { data } = await parseFrontmatterAsync(filePath)
    const cleanFrontmatter = { ...data }
    delete cleanFrontmatter.lastUpdated
    const serialized = JSON.stringify(cleanFrontmatter)
    return crypto.createHash('md5').update(serialized).digest('hex')
  } catch {
    return ''
  }
}

/**
 * Returns the cached frontmatter hash for a file, or undefined if not cached.
 * Excludes the dynamic `lastUpdated` property to avoid HMR hash mismatches.
 */
export function getFrontmatterHash(filePath: string): string | undefined {
  let hash = frontmatterHashes.get(filePath)
  if (hash === undefined) {
    const cachedDoc = docCache.get(filePath)
    if (cachedDoc?.route?.frontmatter) {
      const cleanFrontmatter = { ...cachedDoc.route.frontmatter }
      delete cleanFrontmatter.lastUpdated
      const serialized = JSON.stringify(cleanFrontmatter)
      hash = crypto.createHash('md5').update(serialized).digest('hex')
      frontmatterHashes.set(filePath, hash)
    }
  }
  return hash
}

/**
 * Updates the cached frontmatter hash for a file.
 */
export function setFrontmatterHash(filePath: string, hash: string): void {
  frontmatterHashes.set(filePath, hash)
}

/**
 * Removes the cached frontmatter hash for a file (e.g. when a file is deleted).
 */
export function removeFrontmatterHash(filePath: string): void {
  frontmatterHashes.delete(filePath)
}

/**
 * Clears the entire frontmatter hash cache.
 */
export function clearFrontmatterHashes(): void {
  frontmatterHashes.clear()
}
