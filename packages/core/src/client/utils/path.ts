/**
 * Normalizes a URL path by stripping any trailing slash unless it's the root path.
 *
 * @param p - The path to normalize.
 * @returns The normalized path.
 */
export function normalizePath(p: string): string {
  return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p
}
