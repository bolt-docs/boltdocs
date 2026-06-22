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
 * Extract critical CSS from HTML and CSS content.
 */
export async function extractCriticalCss(html, css, options = {}) {
  const instance = await loadWasm()
  const { memory, processCriticalCss, getResultPtr, getResultLen, reset } =
    instance.exports

  const compress = options.compress !== false ? 1 : 0

  const htmlBytes = new TextEncoder().encode(html)
  const cssBytes = new TextEncoder().encode(css)

  // Grow memory if needed
  const totalNeeded =
    heapBase + htmlBytes.length + cssBytes.length + 1024 * 1024
  const currentMemory = memory.buffer.byteLength
  if (totalNeeded > currentMemory) {
    const pagesNeeded = Math.ceil((totalNeeded - currentMemory) / 65536)
    memory.grow(pagesNeeded)
  }

  // Write inputs into WASM heap
  const inputOffset = heapBase
  const inputBuf = new Uint8Array(
    memory.buffer,
    inputOffset,
    htmlBytes.length + cssBytes.length,
  )
  inputBuf.set(htmlBytes, 0)
  inputBuf.set(cssBytes, htmlBytes.length)

  // Process
  const resultLen = processCriticalCss(
    inputOffset,
    htmlBytes.length,
    inputOffset + htmlBytes.length,
    cssBytes.length,
    compress,
  )

  if (resultLen === 0) {
    reset()
    return { criticalCss: '', stats: {} }
  }

  // Read result from WASM memory at the pointer returned by getResultPtr
  const resultPtr = Number(getResultPtr())
  const resultBytes = new Uint8Array(memory.buffer, resultPtr, resultLen)
  const criticalCss = new TextDecoder().decode(resultBytes.slice())

  // Reset allocator
  reset()

  return { criticalCss, stats: {} }
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
