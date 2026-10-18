import fs from 'node:fs/promises'
import { z } from 'zod'
import { createPlugin, type BoltdocsPlugin, type RouteMeta } from 'boltdocs'
import { getGitHistory } from './git'
import { matchesRoutePath, routeFilePath } from './filters'

export const LastUpdatedOptionsSchema = z.object({
  /**
   * When git has no history for a page (untracked file, shallow clone), fall
   * back to the file modification time. Disabled by default because the core
   * already exposes the modification time when no frontmatter date exists.
   */
  fallbackToMtime: z.boolean().default(false),
  /**
   * Replace a `lastUpdated` date written manually in the frontmatter with the
   * git date. Disabled by default so explicit frontmatter wins.
   */
  overrideFrontmatter: z.boolean().default(false),
  /** Only process routes whose path starts with one of these prefixes. */
  paths: z.array(z.string().min(1)).optional(),
  /** Skip routes whose path starts with one of these prefixes. */
  excludePaths: z.array(z.string().min(1)).optional(),
})

export type LastUpdatedOptions = z.input<typeof LastUpdatedOptionsSchema>

function isExplicitFrontmatterDate(route: RouteMeta): boolean {
  const frontmatterDate = route.frontmatter?.lastUpdated
  if (typeof frontmatterDate === 'string' || frontmatterDate instanceof Date) {
    return true
  }
  // A numeric frontmatter value is the core's file-mtime fallback, not an
  // author-provided date, so git is allowed to replace it.
  return false
}

function toIsoDate(value: string | number | Date): string | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * `@bdocs/plugin-git-meta` — last-updated dates sourced from git.
 *
 * The plugin enriches `route.lastUpdated` through the `routes:resolved` hook,
 * which runs after routes are crawled and before the SSG route table and the
 * client route module are produced. Dates come from the last non-merge commit
 * that touched each markdown file; explicit frontmatter values win unless
 * `overrideFrontmatter` is enabled.
 */
export function lastUpdatedPlugin(
  rawOptions: LastUpdatedOptions = {},
): BoltdocsPlugin {
  const options = LastUpdatedOptionsSchema.parse(rawOptions)

  return createPlugin({
    name: 'boltdocs-plugin-last-updated',
    version: '0.1.0',
    hooks: {
      async 'routes:resolved'(ctx, { routes }) {
        const history = await getGitHistory(ctx.docsDir)
        if (!history.available) {
          ctx.logger.debug(
            `[last-updated] git history unavailable (${history.reason ?? 'unknown'}); keeping existing dates.`,
          )
          return routes
        }

        await Promise.all(
          routes.map(async (route) => {
            if (!matchesRoutePath(route.path, options)) return
            if (
              !options.overrideFrontmatter &&
              isExplicitFrontmatterDate(route)
            ) {
              return
            }

            const file = routeFilePath(route, ctx.docsDir)
            const entry = history.files.get(file)
            if (entry) {
              const date = toIsoDate(entry.lastCommit.date)
              if (date) route.lastUpdated = date
              return
            }

            if (!options.fallbackToMtime) return
            try {
              const stat = await fs.stat(file)
              route.lastUpdated = stat.mtime.toISOString()
            } catch {
              // The page may have been generated from a virtual source.
            }
          }),
        )

        return routes
      },
    },
  }) as BoltdocsPlugin
}
