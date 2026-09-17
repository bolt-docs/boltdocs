import type Beasties from 'beasties'
import type { Options } from 'beasties'

export async function getBeasties(
  outDir: string,
  options: Options = {},
): Promise<Beasties | undefined> {
  try {
    const mod = await import('beasties')
    const BeastiesClass = mod.default || mod
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
  /** Release resources (worker pool). Optional for serial engines. */
  dispose?(): Promise<void>
}

export async function getZigCritters(): Promise<ZigCritters | undefined> {
  try {
    const mod = await import('@bdocs/zig-critters')
    const extractCriticalCss =
      mod.extractCriticalCss || mod.default?.extractCriticalCss
    if (!extractCriticalCss) return undefined
    return { extractCriticalCss }
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
      return {
        extractCriticalCss: (html, css, extractOptions) =>
          pool.extractCriticalCss(html, css, extractOptions),
        dispose: () => pool.dispose(),
      }
    }
  } catch {
    // fall through to serial engine
  }
  return getZigCritters()
}
