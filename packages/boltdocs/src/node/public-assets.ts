import fs from 'node:fs'
import path from 'node:path'

/**
 * Framework-level fix for base-prefixed deployments.
 *
 * Vite serves the `public/` directory under the configured `base` (and Vite's
 * build copies it into the bundle output root), but URLs authored by users —
 * in MDX, React components, or frontmatter — are plain absolute paths such as
 * `/blog-covers/cover.webp`. With `base: '/docs'` those URLs break:
 *
 *   - dev: Vite only serves public files at `<base>/...`, so `/blog-covers/...`
 *     404s.
 *   - SSG: the prerendered HTML embeds the un-based path, which only resolves
 *     when the site is deployed at the domain root.
 *
 * The resolver maps an absolute URL path to its base-prefixed form when — and
 * only when — the path points to a file that actually exists inside the
 * resolved public directory. Lookup results are memoized per process: SSG
 * renders the same assets across hundreds of pages.
 */
export interface PublicAssetResolver {
  /**
   * Returns the base-prefixed URL for `pathname` when it resolves to an
   * existing public file, or null when the path is not a public asset (in
   * which case callers must leave the URL untouched).
   */
  resolve: (pathname: string) => string | null
  /**
   * Cheap pre-scan gate for `rewriteHtmlPublicAssetUrls`: returns false when
   * `html` cannot possibly contain a rewritable public-asset URL, letting the
   * caller skip both scan passes entirely. Built from the public dir's actual
   * top-level entries, so it is a strict superset of what `resolve` can
   * rewrite. Optional — hand-built resolvers without the gate just always run
   * the full passes.
   */
  mightRewrite?: (html: string) => boolean
}

export function createPublicAssetResolver(
  publicDir: string | false | undefined,
  base: string | undefined,
): PublicAssetResolver {
  const cache = new Map<string, string | null>()
  const normalizedBase = normalizeBase(base)

  // Without a base there is nothing to fix: Vite resolves public assets at
  // the root exactly as authored.
  if (!normalizedBase || !publicDir) {
    return { resolve: () => null, mightRewrite: () => false }
  }

  const resolve = (pathname: string): string | null => {
    if (cache.has(pathname)) return cache.get(pathname) ?? null

    let result: string | null = null
    // Already base-prefixed (or another base entirely) — leave it alone.
    if (!pathname.startsWith(`${normalizedBase}/`)) {
      const relative = decodeURIComponent(pathname).replace(/^\//, '')
      const candidate = path.join(publicDir, relative)
      // Path traversal guard: the decoded path must stay inside publicDir.
      if (
        relative.length > 0 &&
        !relative.includes('..') &&
        candidate.startsWith(publicDir) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        result = `${normalizedBase}${pathname}`
      }
    }

    cache.set(pathname, result)
    return result
  }

  // Fast gate: the attribute/srcset passes can only rewrite URLs whose first
  // path segment matches a top-level entry of the public dir (percent-encoded
  // forms included — decodeURIComponent runs before the existence check, and
  // raw bytes of a URL-encoded path never match an unencoded fs entry).
  //
  // The pattern is deliberately unanchored (no attribute-name anchor): a
  // srcset list can have its public candidate in any position after the
  // opening quote, so anchoring on the attribute would miss lists whose first
  // candidate is not public — a correctness bug, not a precision nit. Any
  // occurrence of a public segment as a path segment anywhere in the document
  // trips the gate. That admits harmless false positives (prose mentioning
  // the path), which only cost the normal scan; the segment-end lookahead
  // still rejects longer names that merely start with a public entry
  // (`/logo.pngx` must not trip a `logo.png` gate). Case-insensitive so the
  // gate agrees with `resolve` on case-insensitive filesystems.
  //
  // Pre-compiled once per resolver; pages without any match skip both rewrite
  // passes entirely — the common case on docs sites, where the ~2.3ms/page
  // scan is pure waste across hundreds of pages per re-render.
  let mightRewrite: ((html: string) => boolean) | undefined
  try {
    const firstSegments = fs
      .readdirSync(publicDir)
      .filter((name) => name.length > 0 && name !== '.' && name !== '..')
      .map((name) => encodeForGateAlternation(name))
    if (firstSegments.length > 0) {
      const gatePattern = new RegExp(
        `\\/(?:${firstSegments.join('|')})(?=["/?#\\s])`,
        'i',
      )
      mightRewrite = (html: string) => gatePattern.test(html)
    }
  } catch {
    // Unreadable public dir: no gate, full passes always run (still correct).
    mightRewrite = undefined
  }

  return { resolve, mightRewrite }
}

/**
 * Builds a gate alternation element for a public-dir entry name: regex-escape
 * the literal name, then optionally add the percent-encoded form of every
 * character the URL parser unescapes (e.g. spaces become `%20`), so encoded
 * references like `src="/my%20folder/a.png"` still trip the gate.
 */
function encodeForGateAlternation(name: string): string {
  const escaped = escapeRegExp(name)
  if (!/[ !"#$%&'()+,:;=?@[\]^`{}~]/.test(name)) return escaped
  const encoded = escapeRegExp(
    encodeURIComponent(name).replace(/'/g, '%27').replace(/~/g, '%7E'),
  )
  return `${escaped}|${encoded}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeBase(base: string | undefined): string | null {
  if (!base || base === '/') return null
  const trimmed = base.replace(/\/+$/, '')
  return trimmed.length > 0 && trimmed !== '' ? trimmed : null
}

const HTML_ASSET_ATTRS = '(?:src|href|poster|content)'
const SRCSET_ATTR = 'srcset'

// Pre-compiled once per process — the previous implementation rebuilt these
// per call, measurable when rendering hundreds of pages per build. Shared /g
// regexes are safe with String.replace (lastIndex resets when a scan
// completes); reset defensively in case a replacer throws mid-scan.
//
// Single fused scan: one pass covers both simple URL attributes and srcset
// lists (previously two full-document scans). Alternation order cannot
// mis-split: `srcset="` only completes via the `srcset` alternative because
// `src` must be followed immediately by `="`. Like the two-pass version, the
// regex is case-sensitive (UPPERCASE attribute names were never rewritten).
const FUSED_URL_RE = new RegExp(
  `(${HTML_ASSET_ATTRS}|${SRCSET_ATTR})="([^"]*)"`,
  'g',
)

/**
 * Rewrites absolute URLs in `html` that point to files inside the public
 * directory so they carry the configured base. Handles single-URL attributes
 * (`src`, `href`, `poster`, `content`) and comma-separated `srcset` lists,
 * in one scan. Output is byte-identical with the previous two-pass
 * implementation. Skips the scan entirely when the resolver's gate says the
 * page cannot contain a rewritable URL.
 */
export function rewriteHtmlPublicAssetUrls(
  html: string,
  resolver: PublicAssetResolver,
): string {
  if (resolver.mightRewrite && !resolver.mightRewrite(html)) {
    return html
  }

  FUSED_URL_RE.lastIndex = 0
  return html.replace(FUSED_URL_RE, (match, attr: string, value: string) => {
    // srcset lists: rewrite per-candidate, preserving descriptors and order.
    // Matching on the captured attribute name (not the match prefix) keeps
    // even exotic cases byte-identical with the old two-pass behavior — e.g.
    // `data-srcset="..."` matched inside the attribute name and was treated
    // as a list, exactly as here.
    if (attr === SRCSET_ATTR) {
      let changed = false
      const rewritten = value
        .split(',')
        .map((candidate) => {
          const trimmed = candidate.trim()
          const [url, ...descriptors] = trimmed.split(/\s+/)
          if (!url?.startsWith('/')) return candidate
          const resolved = resolver.resolve(url)
          if (!resolved) return candidate
          changed = true
          return [resolved, ...descriptors].join(' ')
        })
        .join(', ')
      return changed ? `${SRCSET_ATTR}="${rewritten}"` : match
    }

    // Simple attributes: only root-absolute URLs are candidates — exactly the
    // old `(/...)"` capture. Relative srcs must stay untouched.
    if (!value.startsWith('/')) return match
    const resolved = resolver.resolve(value)
    return resolved ? match.replace(value, resolved) : match
  })
}

/**
 * Dev-server middleware: when a request misses the base prefix but resolves
 * to a public asset, redirect to the base-prefixed URL so Vite's static
 * middleware can serve it. This makes user-authored `/cover.webp` references
 * work in the browser even though Vite exposes public files under `<base>`.
 */
export function createPublicAssetRedirectMiddleware(
  publicDir: string | false | undefined,
  base: string | undefined,
) {
  const resolver = createPublicAssetResolver(publicDir, base)
  return function publicAssetRedirectMiddleware(
    req: { url?: string; method?: string },
    res: {
      writeHead: (code: number, headers: Record<string, string>) => void
      end: () => void
    },
    next: () => void,
  ): void {
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    const url = req.url ?? '/'
    const queryIndex = url.indexOf('?')
    const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex)
    if (!pathname.startsWith('/')) {
      next()
      return
    }
    const resolved = resolver.resolve(pathname)
    if (!resolved) {
      next()
      return
    }
    res.writeHead(302, {
      Location: `${resolved}${queryIndex === -1 ? '' : url.slice(queryIndex)}`,
    })
    res.end()
  }
}
