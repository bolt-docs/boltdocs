import type { BoltdocsConfig } from '../../shared/types'

/**
 * The SSG options that do not depend on runtime state.
 *
 * These are shared by two call sites that must never disagree:
 *
 * - the `config()` hook of the Boltdocs Vite plugin, which injects them into
 *   the resolved Vite config used by the production build;
 * - the `boltdocs dev` CLI, which starts the SSG server through the
 *   `skipResolveConfig` fast path and therefore never sees the values that the
 *   `config()` hook would have produced.
 *
 * Duplicating these values is what previously broke dev SSR: the fast path read
 * `viteConfig.ssgOptions` before the hook had run, fell back to the generic
 * `src/main.ts` entry, and every page render failed to resolve an entry module
 * that Boltdocs projects do not have.
 */
export interface BoltdocsStaticSsgOptions {
  entry: string
  htmlEntry: string
  dirStyle: 'flat'
  includeAllRoutes: true
  mock: true
  script: 'async'
  beastiesOptions: false
  criticalCss: 'zig-critters' | 'beasties' | false
  criticalCssMaxSize?: number
}

/**
 * Maps the user-facing `ssg.criticalCss` values to the SSG engine options.
 *
 * `'none'` means "skip critical CSS entirely", which the SSG package spells as
 * `false` rather than as a string.
 */
function resolveCriticalCss(
  configured: 'zig-critters' | 'beasties' | 'none' | undefined,
): 'zig-critters' | 'beasties' | false {
  if (configured === 'none') return false
  if (configured === 'beasties') return 'beasties'
  return 'zig-critters'
}

export function createStaticSsgOptions(
  config?: BoltdocsConfig,
): BoltdocsStaticSsgOptions {
  return {
    entry: 'boltdocs/entry',
    htmlEntry: 'index.html',
    dirStyle: 'flat',
    includeAllRoutes: true,
    // SSR renders React on the server, so the dev server needs a DOM shim.
    mock: true,
    script: 'async',
    beastiesOptions: false,
    criticalCss: resolveCriticalCss(config?.ssg?.criticalCss),
    criticalCssMaxSize: config?.ssg?.criticalCssMaxSize,
  }
}
