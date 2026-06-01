import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { adaptRoutesForSSG } from '../../routes/route-adapter'
import { z } from 'zod'
import { warn } from '@bdocs/dui'

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

export class SEOValidateStep implements PipelineStep<BuildContext> {
  name = 'SEOValidate'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.routes || !ctx.config) {
      throw new Error('Routes or Config not initialized.')
    }

    const siteUrl = ctx.config.siteUrl

    // Shallow/Deep copy elements to prevent context corruption
    ctx.routes = ctx.routes.map((route) => {
      const rawSeo = route.seo || {}
      
      // Calculate defaults
      const canonical = rawSeo.canonical || (siteUrl ? `${siteUrl.replace(/\/$/, '')}${route.path}` : undefined)
      const ogUrl = rawSeo['og:url'] || canonical || undefined

      const enrichedSeo: Record<string, any> = {
        ...rawSeo,
      }

      if (canonical) enrichedSeo.canonical = canonical
      if (ogUrl) enrichedSeo['og:url'] = ogUrl
      if (!enrichedSeo['og:title'] && route.title) {
        enrichedSeo['og:title'] = route.title
      }
      if (!enrichedSeo['og:description'] && route.description) {
        enrichedSeo['og:description'] = route.description
      }

      // Zod Validation
      const result = RouteSeoSchema.safeParse(enrichedSeo)
      if (!result.success) {
        warn(
          `[SEOValidate] Validation issues on route "${route.path}":`,
          result.error.message,
        )
      }

      if (!route.title) {
        warn(`[SEOValidate] Route "${route.path}" is missing a title.`)
      }

      return {
        ...route,
        seo: enrichedSeo,
      }
    })

    // Re-adapt for SSG route list with enriched SEO
    ctx.ssgRoutes = adaptRoutesForSSG(ctx.routes)
  }
}
