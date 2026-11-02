import { z } from 'zod'
import type {
  BoltdocsConfigContract,
  PluginContext,
  RouteMeta,
} from '@bdocs/contracts'

/**
 * Shape of `route.seo` after enrichment.
 *
 * Only used to warn about malformed values. Keys outside this shape —
 * `music:`, `video:`, `article:`, vendor prefixes — pass through untouched and
 * are rendered generically by the client `Head`, so they must not be rejected.
 */
export const RouteSeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().url().optional(),
  robots: z.string().optional(),
  noindex: z.boolean().optional(),
  'og:title': z.string().optional(),
  'og:description': z.string().optional(),
  'og:image': z.string().optional(),
  'og:type': z.string().optional(),
  'og:url': z.string().url().optional(),
})

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * Resolves `canonical`, `og:url` and `og:image` for every route, in place.
 *
 * Runs from the `build:routes` hook, which fires after routes are generated and
 * before the SSG render. That ordering is load-bearing: the client `Head`
 * component reads `route.seo` during render, so enrichment has to happen first.
 * Mutating the route objects rather than replacing the array is equally
 * load-bearing — the same reference has already been handed to Vite's virtual
 * modules, so a new array would leave them holding stale metadata.
 */
export function enrichRouteSeo(
  routes: readonly RouteMeta[],
  config: BoltdocsConfigContract,
  warn: (message: string) => void,
): void {
  const siteUrl = config.siteUrl

  for (const route of routes) {
    const rawSeo: Record<string, unknown> =
      (route.seo as Record<string, unknown> | undefined) ?? {}

    const canonical =
      asString(rawSeo.canonical) ||
      (siteUrl ? `${siteUrl.replace(/\/$/, '')}${route.path}` : undefined)
    const ogUrl = asString(rawSeo['og:url']) || canonical || undefined

    let ogImage =
      asString(rawSeo['og:image']) ||
      route.coverImage ||
      asString(config.seo?.thumbnails?.background)
    if (ogImage && siteUrl && !/^https?:\/\/|^\/\//.test(ogImage)) {
      const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
      const path = ogImage.startsWith('/') ? ogImage : `/${ogImage}`
      ogImage = `${base}${path}`
    }

    const enriched: Record<string, unknown> = { ...rawSeo }

    if (canonical) enriched.canonical = canonical
    if (ogUrl) enriched['og:url'] = ogUrl
    if (ogImage) enriched['og:image'] = ogImage
    if (!enriched['og:title'] && route.title) {
      enriched['og:title'] = String(route.title)
    }
    if (!enriched['og:description'] && route.description) {
      enriched['og:description'] = String(route.description)
    }

    const parsed = RouteSeoSchema.safeParse(enriched)
    if (!parsed.success) {
      warn(
        `[plugin-seo] Invalid route.seo on "${route.path}": ${parsed.error.message}`,
      )
    }

    if (!route.title) {
      warn(`[plugin-seo] Route "${route.path}" is missing a title.`)
    }

    route.seo = enriched
  }
}

/** `build:routes` handler. */
export function handleBuildRoutes(
  ctx: PluginContext,
  params: { routes: RouteMeta[] },
): void {
  enrichRouteSeo(params.routes, ctx.config as BoltdocsConfigContract, (m) =>
    ctx.logger.warn(m),
  )
}
