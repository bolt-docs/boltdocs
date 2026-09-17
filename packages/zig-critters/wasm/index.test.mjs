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

  // Regression tests: these bugs shipped together and produced a mobile
  // layout on desktop — the extractor dropped every desktop `@media` block,
  // and the inline critical `<style>` (mobile-first base rules) then won the
  // cascade over the full stylesheet forever.

  it('keeps rules after a selector containing escaped quotes (regression)', async () => {
    // `.font-features-\[\'ss01\',\'cv01\'\]` has an escaped quote that is part
    // of the identifier. The old parser treated any `'` as a string opener and
    // swallowed the REST OF THE STYLESHEET to EOF, silently dropping every
    // rule after it (measured: everything past ~byte 52K of a 115KB Tailwind
    // bundle vanished, including all desktop media queries).
    const { extractCriticalCss } = await import('./index.mjs')
    const cssWithEscape = `.md\\:block{display:block}@media (min-width:40rem){.lg\\:flex{display:flex}}.font-features-\\[\\'ss01\\'\\,\\'cv01\\'\\]{font-feature-settings:"ss01","cv01"}.after-escape{color:green}.md\\:px-2\\:hover::after{content:"x"}@media (min-width:64rem){.xl\\:grid{display:grid}}`
    const page = `<div class="md:block lg:flex after-escape xl:grid md:px-2"></div>`
    const { criticalCss } = await extractCriticalCss(page, cssWithEscape)
    assert.ok(
      criticalCss.includes('after-escape'),
      'rule AFTER the escaped-quote selector must survive',
    )
    assert.ok(
      criticalCss.includes('xl\\:grid'),
      'media block AFTER the escaped-quote selector must survive',
    )
  })

  it('keeps layout selectors and the media queries that contain them (regression)', async () => {
    // Layout selectors (navbar/sidebar/nav…) were hard-excluded from the
    // critical set, so desktop media queries whose only rules targeted them
    // lost every child and the whole `@media` block was dropped — the exact
    // mechanism behind the mobile-layout-on-desktop bug.
    const { extractCriticalCss } = await import('./index.mjs')
    const navCss = `@media (min-width:64rem){.sidebar{display:block}.navbar{display:flex}}.sidebar{display:none}`
    const page = `<div class="sidebar navbar"></div>`
    const { criticalCss } = await extractCriticalCss(page, navCss)
    assert.ok(
      criticalCss.includes('@media'),
      'media query targeting layout selectors must survive',
    )
    assert.ok(criticalCss.includes('.sidebar'), 'sidebar rule must survive')
  })

  it('extracts from a stylesheet far larger than the legacy fixed arena (regression)', async () => {
    // The JS host reserved a fixed scratch window (~2MB for a 115KB CSS) and
    // the Zig side used a FixedBufferAllocator over it: when it filled up,
    // every `catch continue` silently dropped rules mid-file. Extraction must
    // cover the whole stylesheet regardless of allocation pressure.
    const { extractCriticalCss } = await import('./index.mjs')
    // ~80KB of matching rules + a must-find block at the very end.
    const filler = Array.from(
      { length: 4000 },
      (_, i) => `.m${i}{color:#${(i % 4096).toString(16).padStart(3, '0')}}`,
    ).join('')
    const page = `<div class="m0 m3999 end-marker"></div>`
    const bigCss = `${filler}@media (min-width:40rem){.end-marker{display:flex}}`
    const { criticalCss } = await extractCriticalCss(page, bigCss)
    assert.ok(
      criticalCss.includes('end-marker'),
      'rule at the very end of a large stylesheet must survive',
    )
  })
})
