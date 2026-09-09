export interface ExtractCriticalCssOptions {
  /** Compress serialized critical CSS. Defaults to true. */
  compress?: boolean
  /** Maximum returned critical CSS size in characters. Defaults to 8192. */
  maxSize?: number
  /** Per-invocation WASM arena size in bytes. Clamped to 2–32 MiB. */
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

declare const zigCritters: {
  extractCriticalCss: typeof extractCriticalCss
  processHtml: typeof processHtml
}

export default zigCritters
