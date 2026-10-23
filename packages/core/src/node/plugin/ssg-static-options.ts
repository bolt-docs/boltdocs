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
  mock: boolean
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
  options: { mock?: boolean } = {},
): BoltdocsStaticSsgOptions {
  return {
    entry: 'boltdocs/entry',
    htmlEntry: 'index.html',
    dirStyle: 'flat',
    includeAllRoutes: true,
    // The dev server renders in-process, so a page that touches `window` while
    // it loads needs a DOM there. A production build renders inside its worker
    // pool instead, and none of those workers ever installed the shim: the only
    // DOM was on the main thread, which merely imports the SSR bundle. Importing
    // and constructing jsdom costs ~1 s of every build, so it is opt-in through
    // `ssg.mock` for the rare site whose modules read `document` at import time.
    mock: options.mock ?? config?.ssg?.mock ?? false,
    script: 'async',
    beastiesOptions: false,
    criticalCss: resolveCriticalCss(config?.ssg?.criticalCss),
    criticalCssMaxSize: config?.ssg?.criticalCssMaxSize,
  }
}
