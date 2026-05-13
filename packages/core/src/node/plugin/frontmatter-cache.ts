import crypto from 'node:crypto'
import { parseFrontmatterAsync } from '../utils'

/**
 * In-memory cache for frontmatter hashes.
 * Used to quickly detect if a file's frontmatter (which affects routing/sidebar)
 * changed, vs. only its body content changing (which doesn't affect structure).
 */
const frontmatterHashes = new Map<string, string>()

/**
 * Computes a fast hash of only the frontmatter section of a file.
 * Non-blocking: uses async I/O to avoid stalling the Node.js event loop
 * during HMR file-change events.
 * Returns an empty string if the file has no frontmatter or can't be read.
 */
export async function computeFrontmatterHash(
  filePath: string,
): Promise<string> {
  try {
    const { data } = await parseFrontmatterAsync(filePath)
    const serialized = JSON.stringify(data)
    return crypto.createHash('md5').update(serialized).digest('hex')
  } catch {
    return ''
  }
}

/**
 * Returns the cached frontmatter hash for a file, or undefined if not cached.
 */
export function getFrontmatterHash(filePath: string): string | undefined {
  return frontmatterHashes.get(filePath)
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
