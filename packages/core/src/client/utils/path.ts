/**
 * Normalizes a URL path by stripping any trailing slash unless it's the root path.
 *
 * @param p - The path to normalize.
 * @returns The normalized path.
 */
export function normalizePath(p: string): string {
  return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p
}

/**
 * Resolves a public asset URL under the configured Vite/base path.
 * Root-relative URLs are otherwise interpreted against the origin root, which
 * breaks sites deployed under a documentation base such as `/docs`.
 */
export function resolvePublicAssetUrl(value: string, base?: string): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /^\/(?:https?:|data:)/i.test(value)
  ) {
    return value
  }

  const normalizedBase = (base || '/').replace(/\/+$/, '')
  if (!normalizedBase || normalizedBase === '/') return value
  if (value === normalizedBase || value.startsWith(`${normalizedBase}/`)) {
    return value
  }
  return `${normalizedBase}${value}`
}
