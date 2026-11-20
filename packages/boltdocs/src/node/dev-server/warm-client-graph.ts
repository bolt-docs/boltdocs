import type { ViteDevServer } from 'vite'
import { isServingRequest } from './busy-gate'

/**
 * Modules transformed per batch.
 *
 * The crawl is breadth-first in batches rather than a sequential walk, for two
 * reasons. A sequential walk made an incoming request wait behind every
 * remaining module instead of just the current one. And a batch yields between
 * rounds, which is the only point at which a real request can be served ahead
 * of the warmup.
 */
const BATCH_SIZE = 16

/**
 * Crawls the client module graph and transforms every module in it.
 *
 * The dev server transforms modules on demand, and the browser asks for the
 * whole client graph when it hydrates: 293 modules on the docs site, of 310
 * seen. The MDX files were prewarmed; none of this was, so the browser paid to
 * have each one compiled as it arrived.
 *
 * URLs go to `transformRequest` without the base prefix, matching what Vite's
 * transform middleware does after stripping it. Transformed output contains
 * specifiers *with* the base (`/docs/@id/...`), so every absolute specifier is
 * stripped back down before being queued; without that, `transformRequest`
 * returns null for each child and the crawl stops after the entry — measured at
 * 2 of 530 modules.
 *
 * Dependencies are deliberately not followed. Vite's optimizer pre-bundles them
 * into a handful of files, and `warmDependencies` requests that output
 * directly; crawling their source here would warm the wrong thing.
 *
 * @returns how many modules were transformed, how many were seen, and how long
 * it took.
 */
export async function warmClientGraph(
  server: ViteDevServer,
): Promise<{ warmed: number; total: number; ms: number }> {
  const started = performance.now()
  const base = server.config.base || '/'
  const stripBase = (url: string): string =>
    base !== '/' && url.startsWith(base)
      ? `/${url.slice(base.length).replace(/^\/+/, '')}`
      : url

  const seen = new Set<string>()
  const pending: string[] = [
    stripBase('/@id/__x00__virtual:boltdocs-entry.tsx'),
  ]
  let warmed = 0

  // Static imports/exports and dynamic `import()` specifiers. Vite rewrites
  // every specifier to a dev URL in the transformed output, so a specifier that
  // is still bare at this point is a dependency and is left alone.
  const SPECIFIER =
    /(?:^|[\s;])(?:import|export)\s+(?:[\w*{}$\n\r\t, @]+\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g

  while (pending.length) {
    // A visitor's request outranks the warmup, on both signals: Vite's
    // `_pendingRequests` covers module requests, and `isServingRequest` covers
    // the SSR renders that Boltdocs' own middleware serves.
    const inFlight = (server as ViteDevServer & { _pendingRequests?: number })
      ._pendingRequests
    if ((inFlight || 0) > 0 || isServingRequest()) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      continue
    }

    const batch: string[] = []
    while (pending.length && batch.length < BATCH_SIZE) {
      const url = pending.shift()
      if (url && !seen.has(url)) {
        seen.add(url)
        batch.push(url)
      }
    }
    if (!batch.length) break

    const results = await Promise.allSettled(
      batch.map((url) => server.transformRequest(url)),
    )

    for (const [index, result] of results.entries()) {
      if (result.status !== 'fulfilled' || !result.value) continue
      warmed++
      const code = result.value.code
      for (const match of code.matchAll(SPECIFIER)) {
        const specifier = match[1] || match[2]
        if (!specifier) continue

        // Content files are deliberately not followed. Routes reach their MDX
        // through dynamic imports, and warming those here duplicated the MDX
        // prewarm: it ran without the priority ordering, and it pulled content
        // into the module graph early enough to change what the HMR handler saw
        // on the next edit, which broke the regression asserting that external
        // pages never emit `boltdocs:mdx-update`. The dedicated prewarm already
        // covers them, in priority order, yielding to real requests.
        if (/\.mdx?($|\?)/.test(specifier)) continue

        if (specifier.startsWith('/')) {
          pending.push(stripBase(specifier))
        } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
          pending.push(
            stripBase(new URL(specifier, `http://x${batch[index]}`).pathname),
          )
        }
      }
    }

    // Leave a turn so a request arriving now is served before the next batch.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  return {
    warmed,
    total: seen.size,
    ms: Math.round(performance.now() - started),
  }
}

/**
 * Starts the client graph warmup without blocking the caller. Failures are
 * contained: a module that cannot be warmed is simply transformed later, when
 * the browser asks for it.
 */
export function startClientGraphWarmup(server: ViteDevServer): void {
  void warmClientGraph(server)
    .then(({ warmed, total, ms }) => {
      if (
        process.env.BOLTDOCS_DEBUG === 'true' ||
        process.env.BOLTDOCS_BENCHMARK === 'true'
      ) {
        // eslint-disable-next-line no-console
        console.log(
          `[boltdocs] client graph warm: ${warmed}/${total} modules in ${ms}ms`,
        )
      }
    })
    .catch((error: unknown) => {
      if (process.env.BOLTDOCS_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.warn('[boltdocs] client graph warmup failed:', error)
      }
    })
}
