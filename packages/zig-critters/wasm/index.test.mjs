import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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

const suite = existsSync(wasmPath)
  ? describe
  : /** @param {string} name @param {() => void} fn */ (name, fn) => {
      void fn
      describe(name, () => {
        it('skipped: zig-critters.wasm not built', () => {
          assert.ok(true)
        })
      })
    }

const html = `<!DOCTYPE html><html><head><title>t</title></head><body><div class="hero box"><p class="text">hi</p></div></body></html>`
const css = `body{margin:0}.hero{color:red;background:blue}.box{padding:4px}.text{font-size:12px}.unused{color:pink}`

suite('zig-critters wrapper', () => {
  it('serial extractCriticalCss keeps selectors present in HTML', async () => {
    const { extractCriticalCss } = await import('./index.mjs')
    const { criticalCss } = await extractCriticalCss(html, css)
    assert.ok(criticalCss.includes('.hero'), 'expected .hero in critical CSS')
    assert.ok(criticalCss.includes('body'), 'expected body rule')
    assert.ok(!criticalCss.includes('.unused'), 'did not expect .unused')
  })

  it('serial processHtml injects a style tag before </head>', async () => {
    const { processHtml } = await import('./index.mjs')
    const out = await processHtml(html, css)
    assert.ok(out.includes('<style data-zig-critters>'))
    assert.ok(out.indexOf('</head>') > out.indexOf('<style data-zig-critters>'))
  })

  it('repeated calls with the same CSS string reuse the resident bytes', async () => {
    const { createZigCrittersInstance } = await import('./core.mjs')
    const inst = await createZigCrittersInstance()
    const a = await inst.extractCriticalCssSync(html, css)
    const b = await inst.extractCriticalCssSync(html, css)
    assert.equal(a.criticalCss, b.criticalCss)
    // Different CSS string must invalidate the resident cache.
    const c = await inst.extractCriticalCssSync(html, css + '.zzz{color:#000}')
    assert.ok(
      !c.criticalCss.includes('.zzz'),
      '.zzz has no matching element and must not appear',
    )
  })

  it('pool returns identical results to the serial API and closes cleanly', async () => {
    const mod = await import('./index.mjs')
    const pool = await mod.createPool({ concurrency: 2 })
    if (!pool) return // worker threads unavailable
    try {
      const pages = Array.from({ length: 8 }, (_, i) =>
        html.replace('<title>t</title>', `<title>t${i}</title>`),
      )
      const [serial, pooled] = await Promise.all([
        Promise.all(pages.map((p) => mod.extractCriticalCss(p, css))),
        Promise.all(pages.map((p) => pool.extractCriticalCss(p, css))),
      ])
      for (let i = 0; i < pages.length; i++) {
        assert.equal(serial[i].criticalCss, pooled[i].criticalCss)
      }
    } finally {
      await pool.close()
    }
  })

  it('pool propagates worker errors as rejections', async () => {
    const mod = await import('./index.mjs')
    const pool = await mod.createPool({ concurrency: 1 })
    if (!pool) return
    try {
      await pool.extractCriticalCss(html, css)
    } finally {
      await pool.close()
    }
    // After close() every extraction must reject instead of hanging.
    await assert.rejects(
      pool.extractCriticalCss(html, css),
      /zig-critters pool is closed/,
    )
  })

  it('respects maxSize truncation contract', async () => {
    const { extractCriticalCss } = await import('./index.mjs')
    const bigCss = css + '.x{color:red}'.repeat(200)
    const { criticalCss, stats } = await extractCriticalCss(html, bigCss, {
      maxSize: 10,
    })
    assert.equal(criticalCss, '')
    assert.equal(stats.truncated, true)
  })
})
