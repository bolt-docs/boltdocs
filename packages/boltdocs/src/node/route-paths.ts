/**
 * Single source of truth for the route-path list that feeds editor tooling:
 * the generated `types.d.ts` `RoutePaths` augmentation and `link-tree.json`.
 *
 * Four call sites used to build this list independently (plugin entry,
 * `createViteConfig`, the Vite plugin's `config()` hook, the build pipeline's
 * ConfigResolve step) plus a fifth in the dev server that only passed the raw
 * doc route paths. They drifted: the dev server never learned about external
 * pages or the base, so `/roadmap`, `/showcase`, `/about` and `/docs` were
 * missing from the generated link tree and lost autocompletion entirely.
 *
 * Keeping the assembly here means a route that is reachable at build time is
 * also a valid `href` for the type checker, in every command.
 */

interface RouteLike {
  path: string
}

/**
 * Normalizes a configured base into a comparable prefix: no trailing slash,
 * always leading slash, and `/` when unset.
 *
 * The `/docs` fallback matches the default used across route generation.
 */
export function normalizeBasePath(base: string | undefined): string {
  const trimmed = (base ?? '').replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? '/' : `/${trimmed}`
}

/**
 * Prefixes `pathname` with `basePath`, idempotently.
 *
 * Idempotency matters because doc routes already carry the base in their
 * metadata while collection routes (`/blog/post`) do not, even though both are
 * emitted under the base by the SSG. Prefixing blindly would produce
 * `/docs/docs/guides`; skipping already-prefixed paths would leave
 * `/blog/post` unusable as an `href`. So: add the base only when it is absent.
 */
export function withBasePath(pathname: string, basePath: string): string {
  if (basePath === '/') return pathname
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (path === basePath || path.startsWith(`${basePath}/`)) return path
  return path === '/' ? basePath : `${basePath}${path}`
}

/**
 * Builds the complete, de-duplicated route-path list for generated types and
 * the link tree.
 *
 * Contains, in order: every documentation and collection route under the base,
 * the base itself (`/docs` is a real, linkable page), and the external pages
 * which live at the site root by design and must stay unprefixed.
 */
export function buildTypeRoutePaths(
  routes: readonly RouteLike[],
  base: string | undefined,
  externalPaths: readonly string[] = [],
): string[] {
  const basePath = normalizeBasePath(base)
  const paths: string[] = []
  const add = (candidate: string) => {
    if (candidate && !paths.includes(candidate)) paths.push(candidate)
  }

  for (const route of routes) {
    add(withBasePath(route.path, basePath))
  }
  add(basePath)
  for (const externalPath of externalPaths) {
    add(externalPath)
  }

  return paths
}
