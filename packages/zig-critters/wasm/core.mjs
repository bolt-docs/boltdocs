import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let wasmModulePromise = null

function loadWasmModule() {
  if (!wasmModulePromise) {
    const wasmPath = join(
      __dirname,
      '..',
      'zig',
      'zig-out',
      'bin',
      'zig-critters.wasm',
    )
    const wasmBinary = readFileSync(wasmPath)
    wasmModulePromise = WebAssembly.compile(wasmBinary)
  }
  return wasmModulePromise
}

async function createInstance() {
  const module = await loadWasmModule()
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
  return WebAssembly.instantiate(module, imports)
}

/** Module-level TextEncoder/Decoder: avoids per-call construction. */
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** Page-size units (64 KiB). */
const WASM_PAGE = 65536
const MIN_ARENA = 2 * 1024 * 1024
const MAX_ARENA = 32 * 1024 * 1024

/**
 * One WASM instance with its private memory.
 *
 * Heap layout (all regions start at `__heap_base`):
 *
 *   [ css (resident) ][ html ][ arena ]
 *
 * - The stylesheet is written once and stays resident across calls. When the
 *   caller passes the same CSS string (the SSG hot path: one stylesheet for
 *   the whole build), encoding and copying are skipped entirely.
 * - HTML is rewritten per call into a reusable window.
 * - The arena backs the Zig FixedBufferAllocator and is scratch only; it never
 *   holds data that outlives a call, so it can move when regions grow.
 *
 * Calls on a single instance MUST be serialized (WASM memory is shared). The
 * pool gives each worker its own instance; the serial API queues calls.
 */
class ZigCrittersInstance {
  constructor(instance) {
    this.instance = instance
    const { memory, processCriticalCss, getResultPtr, reset, __heap_base } =
      instance.exports
    this.memory = memory
    this.processCriticalCss = processCriticalCss
    this.getResultPtr = getResultPtr
    this.reset = reset
    this.heapBase = Number(__heap_base.value)

    this.cssString = null
    this.cssBytes = null
    this.cssCapacity = 0
    this.htmlCapacity = 0
    this.arenaSize = MIN_ARENA
  }

  #ensureCapacity(totalBytes) {
    const current = this.memory.buffer.byteLength
    if (totalBytes > current) {
      const pages = Math.ceil((totalBytes - current) / WASM_PAGE)
      if (this.memory.grow(pages) === -1) {
        throw new Error(
          `zig-critters: failed to grow WASM memory by ${pages} pages`,
        )
      }
    }
  }

  /**
   * Return encoded CSS bytes, writing them into the resident region when they
   * changed. Identical string references (the per-build hot path) do zero
   * encoding and zero copying.
   */
  #prepareCss(css) {
    if (css === this.cssString && this.cssBytes) return this.cssBytes

    const bytes = textEncoder.encode(css)
    this.#ensureCapacity(this.heapBase + bytes.length + 64 * 1024)
    new Uint8Array(this.memory.buffer, this.heapBase, bytes.length).set(bytes)

    // Grow the CSS reservation monotonically so the HTML window keeps a
    // stable offset even if a smaller stylesheet arrives later.
    if (bytes.length > this.cssCapacity) this.cssCapacity = bytes.length
    this.arenaSize = Math.max(
      MIN_ARENA,
      Math.min(MAX_ARENA, 4 * this.cssCapacity),
    )

    this.cssString = css
    this.cssBytes = bytes
    return bytes
  }

  /**
   * Extract critical CSS for one page. Returns `{ criticalCss, stats }`.
   */
  extractCriticalCssSync(html, css, options = {}) {
    const cssBytes = this.#prepareCss(css)
    const htmlBytes = textEncoder.encode(html)

    // Ensure layout fits: css + html + arena.
    const htmlOffset = this.heapBase + this.cssCapacity
    if (htmlBytes.length > this.htmlCapacity) {
      this.htmlCapacity = Math.max(htmlBytes.length, this.htmlCapacity * 2)
    }
    this.#ensureCapacity(
      htmlOffset + this.htmlCapacity + this.arenaSize + WASM_PAGE,
    )

    new Uint8Array(this.memory.buffer, htmlOffset, htmlBytes.length).set(
      htmlBytes,
    )

    const compress = options.compress !== false ? 1 : 0
    const resultLen = this.processCriticalCss(
      htmlOffset,
      htmlBytes.length,
      this.heapBase,
      cssBytes.length,
      htmlOffset + this.htmlCapacity,
      this.arenaSize,
      compress,
    )

    // Read the result before resetting globals; the arena bytes stay valid
    // until the next call overwrites them.
    let criticalCss = ''
    if (resultLen > 0) {
      const resultPtr = Number(this.getResultPtr())
      if (resultPtr > 0) {
        criticalCss = textDecoder.decode(
          new Uint8Array(this.memory.buffer, resultPtr, resultLen),
        )
      }
    }
    this.reset()

    if (resultLen === 0) return { criticalCss: '', stats: {} }

    const maxSize = options.maxSize !== undefined ? options.maxSize : 8192
    const truncated = criticalCss.length > maxSize
    if (truncated) criticalCss = ''

    return { criticalCss, stats: { truncated, originalSize: resultLen } }
  }
}

export async function createZigCrittersInstance() {
  return new ZigCrittersInstance(await createInstance())
}

export { textEncoder, textDecoder, MIN_ARENA, MAX_ARENA }
