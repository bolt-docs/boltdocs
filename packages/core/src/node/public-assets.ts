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
    return { resolve: () => null }
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

  return { resolve }
}

function normalizeBase(base: string | undefined): string | null {
  if (!base || base === '/') return null
  const trimmed = base.replace(/\/+$/, '')
  return trimmed.length > 0 && trimmed !== '' ? trimmed : null
}

const HTML_ASSET_ATTRS = '(?:src|href|poster|content)'
const SRCSET_ATTR = 'srcset'

/**
 * Rewrites absolute URLs in `html` that point to files inside the public
 * directory so they carry the configured base. Handles single-URL attributes
 * (`src`, `href`, `poster`, `content`) and comma-separated `srcset` lists.
 */
export function rewriteHtmlPublicAssetUrls(
  html: string,
  resolver: PublicAssetResolver,
): string {
  let result = html.replace(
    new RegExp(`${HTML_ASSET_ATTRS}="(/[^"]*)"`, 'g'),
    (match, url: string) => {
      const resolved = resolver.resolve(url)
      return resolved ? match.replace(url, resolved) : match
    },
  )

  result = result.replace(
    new RegExp(`${SRCSET_ATTR}="([^"]*)"`, 'g'),
    (match, value: string) => {
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
    },
  )

  return result
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
