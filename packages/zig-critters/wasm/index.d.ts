export interface ExtractCriticalCssOptions {
  /** Compress serialized critical CSS. Defaults to true. */
  compress?: boolean
  /** Maximum returned critical CSS size in characters. Defaults to 8192. */
  maxSize?: number
  /** Kept for backwards compatibility; unused by the new wrapper. */
  arenaSize?: number
}

export interface CriticalCssResult {
  criticalCss: string
  stats: Record<string, unknown>
}

export function extractCriticalCss(
  html: string,
  css: string,
  options?: ExtractCriticalCssOptions,
): Promise<CriticalCssResult>

export function processHtml(
  html: string,
  css: string,
  options?: ExtractCriticalCssOptions,
): Promise<string>

export interface ZigCrittersPool {
  readonly concurrency: number
  extractCriticalCss(
    html: string,
    css: string,
    options?: ExtractCriticalCssOptions,
  ): Promise<CriticalCssResult>
  close(): Promise<void>
}

/**
 * Create a worker-threads pool for parallel extraction. Resolves to null when
 * worker threads are unavailable; callers should fall back to the serial API.
 */
export function createPool(options?: {
  concurrency?: number
}): Promise<ZigCrittersPool | null>

/**
 * sha1 identity of the deployed `.wasm` binary. Mix into cache identities that
 * embed extractor output so a new binary invalidates derived caches exactly
 * once. Resolves to `'unknown'` when the binary cannot be read.
 */
export function getEngineIdentity(): Promise<string>

declare const zigCritters: {
  extractCriticalCss: typeof extractCriticalCss
  processHtml: typeof processHtml
  createPool: typeof createPool
  getEngineIdentity: typeof getEngineIdentity
}

export default zigCritters
