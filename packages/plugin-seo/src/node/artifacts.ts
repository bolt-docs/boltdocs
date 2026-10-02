import fs from 'node:fs'
import path from 'node:path'
import type { BoltdocsConfigContract, RouteMeta } from '@bdocs/contracts'
import { generateSitemap } from './sitemap'
import { generateRobotsTxt } from './robots'

/**
 * Writes `sitemap.xml` and `robots.txt` into `outDir`.
 *
 * `robots.txt` is always written. `sitemap.xml` is skipped when `siteUrl` is
 * unset, because a sitemap of relative paths is not something a crawler can
 * consume — that is a configuration gap worth warning about rather than a
 * failure.
 */
export function writeSeoArtifacts(
  routes: readonly RouteMeta[],
  config: BoltdocsConfigContract,
  outDir: string,
  warn: (message: string) => void,
): { sitemap: boolean; robots: boolean } {
  fs.mkdirSync(outDir, { recursive: true })

  const sitemap = generateSitemap(routes, config)
  if (sitemap) {
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap, 'utf-8')
  }

  fs.writeFileSync(
    path.join(outDir, 'robots.txt'),
    generateRobotsTxt(config),
    'utf-8',
  )

  if (!sitemap) {
    warn(
      '[plugin-seo] No sitemap.xml written: set `siteUrl` in boltdocs.config.ts.',
    )
  }

  return { sitemap: Boolean(sitemap), robots: true }
}
