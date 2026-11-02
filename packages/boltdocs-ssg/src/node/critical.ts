import type Beasties from 'beasties'
import type { Options } from 'beasties'

/**
 * Loads a dependency on demand.
 *
 * Injectable so a test can decide what "the package" is without mocking the
 * module specifier. A specifier mock is only honoured if it is registered
 * before the target module enters the module graph, which made the failure
 * modes of these wrappers depend on which test file ran first in a worker:
 * the mock silently did not apply and the test asserted on the real package.
 */
type DependencyLoader = () => Promise<unknown>

export async function getBeasties(
  outDir: string,
  options: Options = {},
  load: DependencyLoader = () => import('beasties'),
): Promise<Beasties | undefined> {
  try {
    const mod = (await load()) as { default?: typeof Beasties }
    const BeastiesClass = (mod.default || mod) as typeof Beasties
    return new BeastiesClass({
      path: outDir,
      logLevel: 'warn',
      external: true,
      inlineFonts: true,
      preloadFonts: true,
      ...options,
    })
  } catch {
    return undefined
  }
}

/**
 * Default per-page budget (in bytes) for inline critical CSS. The 8KB default
 * inherited from the extraction engine silently discarded the critical CSS of
 * real docs sites, so the framework default was raised once (24KB) — but that
 * value was calibrated against a buggy extractor that dropped every desktop
 * media query. Honest extraction of the same docs site measures ~26KB, so the
 * default is 32KB; sites can tune it via `ssg.criticalCssMaxSize`. Exceeding
 * the budget skips the inline critical CSS entirely (full stylesheet still
 * loads), trading first-paint polish for correctness.
 */
export const DEFAULT_CRITICAL_CSS_MAX_SIZE = 32 * 1024

/**
 * Resolve the effective critical-CSS budget from user configuration. Accepts
 * the raw `ssg.criticalCssMaxSize` value (number | undefined) so build.ts can
 * pass config straight through without its own validation logic.
 */
export function resolveCriticalCssMaxSize(
  configMaxSize: number | undefined,
): number {
  if (typeof configMaxSize === 'number' && configMaxSize >= 0) {
    return configMaxSize
  }
  return DEFAULT_CRITICAL_CSS_MAX_SIZE
}

export interface ZigCritters {
  /**
   * Extract the critical CSS for one page. Implementations return only the
   * CSS; callers handle injection and truncation reporting.
   */
  extractCriticalCss(
    html: string,
    css: string,
    options?: { compress?: boolean; maxSize?: number },
  ): Promise<{ criticalCss: string; stats: Record<string, unknown> }>
  /**
   * sha1 identity of the deployed extractor binary. Caches that embed
   * extractor output (critical-CSS payloads, rendered pages) must mix this
   * into their keys — an engine-name string alone never changes when the
   * binary does, so poisoned payloads could be served forever.
   */
  getEngineIdentity(): Promise<string>
  /** Release resources (worker pool). Optional for serial engines. */
  dispose?(): Promise<void>
}

/**
 * The serial critical-CSS engine, or `undefined` when the package is missing or
 * exposes no extractor.
 *
 * `load` defaults to importing `@bdocs/zig-critters`; a test passes its own
 * loader instead of mocking the specifier (see {@link DependencyLoader}).
 */
export async function getZigCritters(
  load: DependencyLoader = () => import('@bdocs/zig-critters'),
): Promise<ZigCritters | undefined> {
  try {
    const mod = (await load()) as {
      extractCriticalCss?: ZigCritters['extractCriticalCss']
      getEngineIdentity?: () => Promise<unknown>
      default?: {
        extractCriticalCss?: ZigCritters['extractCriticalCss']
        getEngineIdentity?: () => Promise<unknown>
      }
    }
    const extractCriticalCss =
      mod.extractCriticalCss || mod.default?.extractCriticalCss
    if (!extractCriticalCss) return undefined
    return {
      extractCriticalCss,
      getEngineIdentity: () => {
        const fn = mod.getEngineIdentity || mod.default?.getEngineIdentity
        if (!fn) return Promise.resolve('unknown')
        return fn()
          .then((v: unknown) => String(v))
          .catch(() => 'unknown')
      },
    }
  } catch {
    return undefined
  }
}

/**
 * Prefer a worker-threads pool (one WASM instance per worker, true parallel
 * extraction); fall back to the process-global serial instance when the pool
 * is unavailable (e.g. worker threads disabled, mocked package in tests).
 */
export async function createZigCrittersEngine(
  options: { concurrency?: number } = {},
): Promise<ZigCritters | undefined> {
  try {
    const { createZigCrittersPool } = await import('./zig-pool')
    const pool = await createZigCrittersPool(options)
    if (pool) {
      // Identity comes from the package (the binary both pool and serial
      // engine execute); same digest regardless of which engine serves calls.
      const identity = await getZigCritters().then((s) =>
        s?.getEngineIdentity(),
      )
      return {
        extractCriticalCss: (html, css, extractOptions) =>
          pool.extractCriticalCss(html, css, extractOptions),
        getEngineIdentity: async () => identity ?? 'unknown',
        dispose: () => pool.dispose(),
      }
    }
  } catch {
    // fall through to serial engine
  }
  return getZigCritters()
}
