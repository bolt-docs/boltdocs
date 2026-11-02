import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import { getExternalRoutePaths } from '../routes'
import { normalizeBasePath } from '../route-paths'

/**
 * Makes site-root external pages reachable in the dev server.
 *
 * Vite is configured with the same `base` as Boltdocs (see `createViteConfig`),
 * and Vite's base middleware answers every request outside that base with
 * `404 The server is configured with a public base URL of /docs`. That is
 * correct for assets, but external pages are real routes that live at the site
 * root by design: `/`, `/about`, `/roadmap`, `/showcase`. The navbar links to
 * them as `site:/roadmap`, and the SSG emits them at the dist root, so
 * production has always served them correctly while dev could not.
 *
 * Rather than giving up the base (which would move every emitted asset URL and
 * break the docs tree), this rewrites the *internal* URL of a known external
 * path to its base-prefixed form. Boltdocs' SSG middleware already normalizes
 * with `stripBase`, so the request resolves to the exact same route it would
 * have matched at the root. The browser URL is never touched, and the rendered
 * HTML references assets with absolute `/docs/...` URLs that keep resolving.
 */

let cachedPaths: Map<string, string> | null = null
let cachedFor: string | null = null

/**
 * Clears the memoized external-path set.
 *
 * Called when routes are invalidated so a newly added or removed
 * `pages-external` entry is picked up without restarting the dev server.
 */
export function invalidateExternalPagePaths(): void {
  cachedPaths = null
  cachedFor = null
}

function resolveExternalPaths(
  docsDir: string,
  config: BoltdocsConfig,
): Map<string, string> {
  const basePath = normalizeBasePath(config.base)
  const key = `${basePath}\u0000${config.i18n ? Object.keys(config.i18n.locales).join(',') : ''}`
  if (cachedPaths && cachedFor === key) return cachedPaths

  // With a root base there is nothing to work around: Vite never rejects a
  // path, so external pages are already reachable as-is.
  if (basePath === '/') {
    cachedPaths = new Map()
    cachedFor = key
    return cachedPaths
  }

  // original site-root path -> the base-prefixed path that gets past Vite's
  // base middleware and lands on the same route after `stripBase`.
  const paths = new Map<string, string>()
  for (const externalPath of getExternalRoutePaths(docsDir, config)) {
    // Anything already inside the base is served normally and must be left
    // alone; only site-root paths need the rewrite.
    if (externalPath === basePath || externalPath.startsWith(`${basePath}/`)) {
      continue
    }
    paths.set(
      externalPath,
      externalPath === '/' ? basePath : `${basePath}${externalPath}`,
    )
  }

  cachedPaths = paths
  cachedFor = key
  return paths
}

/**
 * Installs the rewrite ahead of Vite's internal middlewares.
 *
 * `configureServer` hooks run *after* Vite's own middlewares, so returning a
 * teardown function is not enough here: the base middleware would already have
 * answered 404. Pushing onto the connect stack directly is the documented way
 * to run before internal middlewares.
 */
export function installExternalPageRewrite(
  server: ViteDevServer,
  docsDir: string,
  getConfig: () => BoltdocsConfig,
): void {
  const rewrite = (
    req: { url?: string; method?: string },
    _res: unknown,
    next: (err?: unknown) => void,
  ): void => {
    // Connect middlewares must always delegate: this one only inspects and
    // rewrites, so `next()` is mandatory or every request hangs.
    try {
      if (
        req.url &&
        (!req.method || req.method === 'GET' || req.method === 'HEAD')
      ) {
        const pathname = req.url.split('?')[0]
        const rewritten = pathname
          ? resolveExternalPaths(docsDir, getConfig()).get(pathname)
          : undefined
        if (rewritten) {
          req.url = `${rewritten}${req.url.slice(pathname.length)}`
        }
      }
    } catch {
      // Route discovery failures must not take the dev server down; fall
      // through to Vite's own handling.
    }
    next()
  }

  server.middlewares.stack.unshift({
    route: '',
    handle: rewrite as (
      req: unknown,
      res: unknown,
      next: (err?: unknown) => void,
    ) => void,
  })
}
