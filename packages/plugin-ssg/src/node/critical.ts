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
