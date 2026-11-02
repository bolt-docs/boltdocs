import { performance } from 'node:perf_hooks'
import { availableParallelism } from 'node:os'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const wasmPath = join(
  __dirname,
  '..',
  'zig',
  'zig-out',
  'bin',
  'zig-critters.wasm',
)

if (!existsSync(wasmPath)) {
  console.error(
    'zig-critters.wasm not found — run `pnpm run build:wasm` first.',
  )
  process.exit(1)
}

const mod = await import('./../wasm/index.mjs')

// Synthetic docs-shaped pages: shared shell + unique content classes.
// Sizes are scaled to match a real production build (~150KB stylesheet,
// ~100KB rendered page) so the comparison is representative.
const block = `
.sidebar { width: 240px; } .navbar { height: 56px; } .toc { font-size: 13px; }
.hero { padding: 48px 24px; } .hero h1 { font-size: 32px; }
.prose p { margin: 0 0 1em; line-height: 1.7; }
.prose code { background: #f4f4f5; padding: 2px 4px; border-radius: 4px; }
.card { border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; }
.card:hover { border-color: #a1a1aa; }
.footer { padding: 24px; text-align: center; }
`
const css =
  `:root { --fg: #222; --bg: #fff; }
body { margin: 0; font-family: sans-serif; }` + block.repeat(280)
const PAGE_COUNT = 200
console.log(
  `stylesheet ${(Buffer.byteLength(css) / 1024).toFixed(0)}KB, pages ~100KB, ${PAGE_COUNT} pages`,
)
const pages = Array.from({ length: PAGE_COUNT }, (_, i) => {
  const content = Array.from(
    { length: 40 },
    (_, j) => `<p class="p${(i * 40 + j) % 97}">Paragraph ${i}-${j}</p>`,
  ).join('\n')
  const body = `<div class="hero"><h1>Title ${i}</h1></div><div class="prose">${content}</div>`
  return `<!DOCTYPE html><html><head><title>Page ${i}</title></head><body>${body.repeat(
    40,
  )}</body></html>`
})

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ]
}

function summarize(label, times) {
  const total = times.reduce((a, b) => a + b, 0)
  console.log(
    `${label.padEnd(22)} total ${total.toFixed(0).padStart(6)}ms | mean ${(
      total / times.length
    )
      .toFixed(2)
      .padStart(
        7,
      )}ms | p50 ${percentile(times, 50).toFixed(2)}ms | p95 ${percentile(times, 95).toFixed(2)}ms`,
  )
  return total
}

// Warmup (module + WASM compile + first allocations)
await mod.extractCriticalCss(pages[0], css)

// Serial
{
  const times = []
  for (const page of pages) {
    const start = performance.now()
    await mod.extractCriticalCss(page, css)
    times.push(performance.now() - start)
  }
  summarize('serial (1 instance)', times)
}

// Pool
const concurrency = Math.min(availableParallelism(), 8)
{
  const pool = await mod.createPool({ concurrency })
  try {
    const times = []
    const startAll = performance.now()
    await Promise.all(
      pages.map(async (page) => {
        const start = performance.now()
        await pool.extractCriticalCss(page, css)
        times.push(performance.now() - start)
      }),
    )
    summarize(`pool (x${concurrency})`, times)
    console.log(
      `pool wall-clock ${(performance.now() - startAll).toFixed(0)}ms for ${PAGE_COUNT} pages`,
    )
  } finally {
    await pool.close()
  }
}
