import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let wasmInstance = null
let heapBase = 0

async function loadWasm() {
  if (wasmInstance) return wasmInstance

  const wasmPath = join(
    __dirname,
    '..',
    'zig',
    'zig-out',
    'bin',
    'zig-critters.wasm',
  )
  const wasmBinary = readFileSync(wasmPath)

  const module = await WebAssembly.compile(wasmBinary)

  const imports = {
    env: {
      __multi3: (a, b) => {
        if (typeof a === 'bigint' && typeof b === 'bigint') return a * b
        return Number(a) * Number(b)
      },
      __divti3: (a, b) => {
        if (typeof a === 'bigint' && typeof b === 'bigint') return a / b
        return Number(a) / Number(b)
      },
      __modti3: (a, b) => {
        if (typeof a === 'bigint' && typeof b === 'bigint') return a % b
        return Number(a) % Number(b)
      },
    },
  }

  const instance = await WebAssembly.instantiate(module, imports)
  wasmInstance = instance
  heapBase = Number(instance.exports.__heap_base.value)
  return instance
}

/**
 * WASM memory and the exported allocator are process-global. Keep calls
 * serialized so concurrent SSG pages cannot overwrite each other's inputs or
 * reset the allocator while another result is being read.
 */
let extractionQueue = Promise.resolve()

async function extractCriticalCssInternal(html, css, options = {}) {
  const instance = await loadWasm()
  const { memory, processCriticalCss, getResultPtr, reset } = instance.exports

  try {
    const compress = options.compress !== false ? 1 : 0

    const htmlBytes = new TextEncoder().encode(html)
    const cssBytes = new TextEncoder().encode(css)

    // Compute layout: [inputs at heapBase][arena after inputs]
    const inputOffset = heapBase
    const inputEnd = inputOffset + htmlBytes.length + cssBytes.length
    // Leave enough room for large production HTML/CSS inputs and selector
    // allocations. The WASM allocator still bounds each invocation, while the
    // input-size-aware budget avoids silently returning an empty result for
    // large documentation pages.
    const requestedArenaSize = options.arenaSize ?? 2 * 1024 * 1024
    const arenaSize = Math.max(
      2 * 1024 * 1024,
      Math.min(32 * 1024 * 1024, requestedArenaSize),
    )
    const arenaOffset = inputEnd

    // Grow memory to fit inputs + arena
    const totalNeeded = arenaOffset + arenaSize
    const currentMemory = memory.buffer.byteLength
    if (totalNeeded > currentMemory) {
      const pagesNeeded = Math.ceil((totalNeeded - currentMemory) / 65536)
      memory.grow(pagesNeeded)
    }

    // Write inputs into WASM heap (at heapBase)
    const inputBuf = new Uint8Array(
      memory.buffer,
      inputOffset,
      htmlBytes.length + cssBytes.length,
    )
    inputBuf.set(htmlBytes, 0)
    inputBuf.set(cssBytes, htmlBytes.length)

    // Process: pass arena offset and size so WASM can use FixedBufferAllocator
    const resultLen = processCriticalCss(
      inputOffset,
      htmlBytes.length,
      inputOffset + htmlBytes.length,
      cssBytes.length,
      arenaOffset,
      arenaSize,
      compress,
    )

    if (resultLen === 0) return { criticalCss: '', stats: {} }

    // Read result from WASM memory at the pointer returned by getResultPtr.
    const resultPtr = Number(getResultPtr())
    const resultBytes = new Uint8Array(memory.buffer, resultPtr, resultLen)
    let criticalCss = new TextDecoder().decode(resultBytes.slice())

    const maxSize = options.maxSize !== undefined ? options.maxSize : 8192
    const truncated = criticalCss.length > maxSize
    if (truncated) criticalCss = ''

    return { criticalCss, stats: { truncated, originalSize: resultLen } }
  } finally {
    // Always restore allocator state before the next queued extraction.
    reset()
  }
}

/**
 * Extract critical CSS from HTML and CSS content.
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

export default { extractCriticalCss, processHtml }
