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

  // Compute layout: [inputs at heapBase][arena after inputs]
  const inputOffset = heapBase
  const inputEnd = inputOffset + htmlBytes.length + cssBytes.length
  const arenaSize = 2 * 1024 * 1024 // 2MB buffer for all allocations
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

  if (resultLen === 0) {
    console.error(
      `[zig-critters/debug] WASM returned 0 (empty CSS). HTML=${(htmlBytes.length / 1024).toFixed(1)}KB, CSS=${(cssBytes.length / 1024).toFixed(1)}KB, memory=${(currentMemory / 1024 / 1024).toFixed(1)}MB`,
    )
    reset()
    return { criticalCss: '', stats: {} }
  }

  // Read result from WASM memory at the pointer returned by getResultPtr
  const resultPtr = Number(getResultPtr())
  const resultBytes = new Uint8Array(memory.buffer, resultPtr, resultLen)
  const criticalCss = new TextDecoder().decode(resultBytes.slice())

  const cssLenKB = (cssBytes.length / 1024).toFixed(1)
  console.error(
    `[zig-critters/debug] Generated ${(resultLen / 1024).toFixed(1)}KB critical CSS from ${cssLenKB}KB CSS`,
  )

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
