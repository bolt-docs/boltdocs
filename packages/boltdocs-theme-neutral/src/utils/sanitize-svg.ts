import DOMPurify from 'dompurify'

/**
 * SVG sanitization for icon markup rendered with `dangerouslySetInnerHTML`.
 *
 * This is a real HTML sink, unlike the frontmatter text that used to be run
 * through a sanitizer: whatever arrives here ends up as markup in the document.
 * So it stays — but it is no longer paid for on every render.
 *
 * `IconRenderer` re-runs on every parent render, and a navbar or sidebar
 * re-renders on navigation, theme change and sidebar toggle. Each pass was
 * re-parsing the same SVG string and re-serializing the same DOM. Sanitizing is
 * deterministic in the input, so the result is cached by the exact string.
 *
 * The cache is keyed on the full markup, never on an icon name, because the
 * name is exactly the part a caller controls and reusing one entry's result for
 * another would be a sanitization bypass. Bounded because a page realistically
 * registers a handful of icons, but a caller could in principle pass
 * unbounded distinct strings.
 */
const CACHE_LIMIT = 256
const cache = new Map<string, string>()

/** Sanitizes SVG markup, memoized by exact input. */
export function sanitizeSvgMarkup(markup: string): string {
  const cached = cache.get(markup)
  if (cached !== undefined) return cached

  const clean = DOMPurify.sanitize(markup, { USE_PROFILES: { svg: true } })

  // Evict oldest first. Map preserves insertion order, so this is LRU enough:
  // a re-sanitized string is re-inserted by deleting before setting.
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(markup, clean)

  return clean
}

/** Empties the cache. Exposed for tests. */
export function clearSvgSanitizeCache(): void {
  cache.clear()
}
