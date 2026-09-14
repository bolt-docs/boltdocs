import { createZigCrittersInstance } from './core.mjs'

/**
 * Serial fallback API.
 *
 * A single WASM instance is process-global with shared memory, so calls on it
 * are serialized through a promise chain. For parallel extraction use
 * `createZigCrittersPool()` (worker threads, one instance per worker), which
 * the SSG integration prefers when available.
 */
let serialInstance = null
let extractionQueue = Promise.resolve()

async function getInstance() {
  if (!serialInstance) serialInstance = await createZigCrittersInstance()
  return serialInstance
}

async function extractCriticalCssInternal(html, css, options = {}) {
  const instance = await getInstance()
  return instance.extractCriticalCssSync(html, css, options)
}

/**
 * Extract critical CSS from HTML and CSS content.
 * Returns `{ criticalCss, stats }`.
 */
export function extractCriticalCss(html, css, options = {}) {
  const extraction = extractionQueue.then(() =>
    extractCriticalCssInternal(html, css, options),
  )
  extractionQueue = extraction.then(
    () => undefined,
    () => undefined,
  )
  return extraction
}

/**
 * Process HTML and inline critical CSS.
 */
export async function processHtml(htmlContent, cssContent, options = {}) {
  const { criticalCss } = await extractCriticalCss(
    htmlContent,
    cssContent,
    options,
  )

  if (criticalCss && criticalCss.length > 0) {
    const styleTag = `<style data-zig-critters>${criticalCss}</style>`
    if (htmlContent.includes('</head>')) {
      return htmlContent.replace('</head>', `${styleTag}</head>`)
    }
    return `${styleTag}${htmlContent}`
  }

  return htmlContent
}

/**
 * Create a worker-threads pool for parallel extraction. Each worker owns a
 * private WASM instance, so pages are processed concurrently. Returns null
 * when worker threads are unavailable (callers should fall back to the serial
 * API above).
 */
export async function createPool(options = {}) {
  try {
    const { createZigCrittersPool } = await import('./pool.mjs')
    return createZigCrittersPool(options)
  } catch {
    return null
  }
}

export default { extractCriticalCss, processHtml, createPool }
