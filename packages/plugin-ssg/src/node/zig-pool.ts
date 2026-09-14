import type { ZigCritters } from './critical'

export interface ZigCrittersPoolHandle {
  extractCriticalCss(
    html: string,
    css: string,
    options?: { compress?: boolean; maxSize?: number },
  ): Promise<{ criticalCss: string; stats: Record<string, unknown> }>
  dispose(): Promise<void>
  readonly concurrency: number
}

/**
 * Create a worker-threads pool over zig-critters for parallel extraction.
 * Resolves to null when the package or pool API is unavailable, so callers
 * can fall back to the serial engine.
 */
export async function createZigCrittersPool(
  options: { concurrency?: number } = {},
): Promise<ZigCrittersPoolHandle | null> {
  let mod: any
  try {
    mod = await import('@bdocs/zig-critters')
  } catch {
    return null
  }
  if (typeof mod.createPool !== 'function') return null
  try {
    const pool = await mod.createPool(options)
    if (!pool) return null
    const handle: ZigCrittersPoolHandle = {
      concurrency: pool.concurrency,
      extractCriticalCss: (html, css, extractOptions) =>
        pool.extractCriticalCss(html, css, extractOptions),
      dispose: () => pool.close(),
    }
    return handle
  } catch {
    return null
  }
}

export type { ZigCritters }
