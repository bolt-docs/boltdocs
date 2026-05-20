import { FileCache } from '../cache'
import type { ParsedDocFile } from './types'
import { ParserCache } from './parser/cache'

/**
 * Persistent cache for parsed documentation files.
 * Saves data to `.boltdocs/routes.json`.
 */
const docCache = new FileCache<ParsedDocFile>({ name: 'routes' })

/**
 * Invalidate all cached routes.
 * Typically called when a file is added or deleted, requiring a complete route rebuild.
 */
export function invalidateRouteCache(): void {
  docCache.invalidateAll()
  ParserCache.clear()
}

/**
 * Invalidate a specific file from cache.
 * Called when a specific file is modified (changed).
 *
 * @param filePath - The absolute path of the file to invalidate
 */
export function invalidateFile(filePath: string): void {
  docCache.invalidate(filePath)
  ParserCache.invalidate(filePath)
}

export { docCache }
