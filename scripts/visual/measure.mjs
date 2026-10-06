/**
 * Measures a component in the built site, and can diff two builds of it.
 *
 * The generalisation of `measure-pagenav.mjs`, which it supersedes.
 *
 * Why this exists: a pixel diff answers "did anything change", and when a
 * conversion is *almost* right that is a two-percent answer that points at
 * nothing. This answers "which property, on which element, went from what to
 * what". Guessing from a diff got two components blamed for a rail that had
 * quietly lost 40 pixels.
 *
 * Targets are named components rather than CSS selectors, because a selector
 * that has to work across the old and new markup is exactly the thing that
 * silently lands on the wrong element — which is how one reading claimed the
 * page-nav title was a glyph.
 *
 * Usage:
 *   node scripts/visual/measure.mjs <label>                    # measure
 *   node scripts/visual/measure.mjs compare <a> <b>            # diff two labels
 */
import { createServer } from 'node:http'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const rootRequire = createRequire(
  resolve(fileURLToPath(import.meta.url), '../../../package.json'),
)
const { chromium } = rootRequire('playwright')

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..')
const SITE = join(ROOT, 'docs/dist')
const OUT = join(ROOT, '.visual')

/** The properties a utility class can actually set. */
const PROPS = [
  'display',
  'position',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
  'grid-template-columns',
  'padding',
  'padding-top',
  'padding-bottom',
  'margin',
  'margin-top',
  'margin-bottom',
  'width',
  'max-width',
  'height',
  'min-height',
  'overflow',
  'overflow-x',
  'overflow-y',
  'color',
  'background-color',
  'border-width',
  'border-top-width',
  'border-bottom-width',
  'border-radius',
  'border-top-left-radius',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-align',
  'text-overflow',
  'white-space',
  'opacity',
  'z-index',
  'visibility',
  'box-shadow',
  'flex-shrink',
  'flex-grow',
  'flex-wrap',
  'aspect-ratio',
]

/**
 * Each target names a component, a page that documents it, and a selector
 * *within* that component that means the same thing in both markups.
 *
 * The selectors deliberately avoid class names: the conversion replaces those,
 * so a class-based selector measures one build and misses the other. These go
 * through the landmark the component owns — `pre` inside `figure`, the heading
 * inside the table of contents — which survives the conversion.
 */
const TARGETS = [
  {
    name: 'code block',
    page: 'docs/components/mdx/code-blocks.html',
    parts: {
      wrapper: '.bdocs-code, figure:has(pre), div:has(> pre)',
      pre: 'pre',
      header: 'figure > div:first-child',
      language: 'figure > div:first-child span:first-child',
      actions:
        'figure > div:first-child button, figure > div:first-child [role="button"]',
      code: 'pre code',
    },
  },
  {
    name: 'copy markdown',
    page: 'docs/guides/getting-started/installation.html',
    parts: {
      button: 'button[aria-label*="opy"], button[title*="opy"]',
      label: 'button[aria-label*="opy"] span, button[title*="opy"] span',
    },
  },
  {
    name: 'page nav',
    page: 'docs/components/layout/page-nav.html',
    parts: {
      root: 'nav[aria-label="Pagination"]',
      card: 'nav[aria-label="Pagination"] > a',
      body: 'nav[aria-label="Pagination"] > a > :first-child',
      title: 'nav[aria-label="Pagination"] > a > :first-child > :first-child',
      label: 'nav[aria-label="Pagination"] > a > :first-child > :last-child',
      icon: 'nav[aria-label="Pagination"] > a > :last-child',
    },
  },
  {
    name: 'breadcrumbs',
    page: 'docs/components/layout/breadcrumbs.html',
    parts: {
      root: 'nav[aria-label*="readcrumb"], ol:has(> li > a[href="/"])',
      link: 'ol > li > a, nav[aria-label*="readcrumb"] a',
      separator: 'ol > li > span, ol > li > svg',
    },
  },
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function siteBase() {
  return (
    readFileSync(join(ROOT, 'docs/boltdocs.config.ts'), 'utf-8').match(
      /base:\s*'([^']+)'/,
    )?.[1] ?? '/'
  )
}

function resolveFile(url, base) {
  const stripped = url.startsWith(base) ? url.slice(base.length) || '/' : url
  for (const file of [
    join(SITE, url),
    join(SITE, stripped),
    join(SITE, `${url.replace(/\/$/, '')}.html`),
    join(SITE, `${stripped.replace(/\/$/, '')}.html`),
    join(SITE, stripped, 'index.html'),
  ]) {
    if (existsSync(file) && statSync(file).isFile()) return file
  }
  return null
}

async function capture(label) {
  const port = 5299
  const base = siteBase()
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    const file = resolveFile(url, base)
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    })
    createReadStream(file).pipe(res)
  })
  await new Promise((done) => server.listen(port, done))

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  await context.route('**', (route) =>
    route.request().url().startsWith(`http://localhost:${port}`)
      ? route.continue()
      : route.abort(),
  )
  const page = await context.newPage()

  const out = {}
  for (const target of TARGETS) {
    if (!existsSync(join(SITE, target.page))) continue
    await page.goto(`http://localhost:${port}/${target.page}`, {
      waitUntil: 'load',
      timeout: 120_000,
    })
    await page.evaluate(() =>
      Promise.race([
        document.fonts.ready,
        new Promise((d) => setTimeout(d, 2000)),
      ]),
    )
    const rows = await page.evaluate(
      ({ parts, props }) => {
        const result = {}
        for (const [name, selector] of Object.entries(parts)) {
          const el = document.querySelector(selector)
          if (!el) {
            result[name] = null
            continue
          }
          const cs = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          const values = {}
          for (const p of props) values[p] = cs.getPropertyValue(p)
          result[name] = {
            box: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            values,
          }
        }
        return result
      },
      { parts: target.parts, props: PROPS },
    )
    out[target.name] = rows
  }

  await browser.close()
  server.close()

  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `${label}.measure.json`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`)
  const found = Object.values(out)
    .flatMap((r) => Object.values(r))
    .filter(Boolean).length
  console.log(`✓ ${label}: ${found} elementos medidos → ${file}`)
  return out
}

function compare(a, b) {
  const A = JSON.parse(readFileSync(join(OUT, `${a}.measure.json`), 'utf-8'))
  const B = JSON.parse(readFileSync(join(OUT, `${b}.measure.json`), 'utf-8'))
  const rows = []
  for (const component of [
    ...new Set([...Object.keys(A), ...Object.keys(B)]),
  ].sort()) {
    const x = A[component]
    const y = B[component]
    if (!x || !y) {
      rows.push({ component, note: x ? 'solo en A' : 'solo en B' })
      continue
    }
    for (const part of [
      ...new Set([...Object.keys(x), ...Object.keys(y)]),
    ].sort()) {
      const px = x[part]
      const py = y[part]
      if (!px || !py) {
        rows.push({
          component: `${component}/${part}`,
          note: px ? 'desaparecio' : 'aparecio',
        })
        continue
      }
      const props = []
      if (px.box !== py.box) props.push(`box ${px.box} -> ${py.box}`)
      for (const p of PROPS) {
        if (px.values[p] !== py.values[p])
          props.push(`${p}: ${px.values[p]} -> ${py.values[p]}`)
      }
      if (props.length > 0)
        rows.push({ component: `${component}/${part}`, note: props.join('; ') })
    }
  }
  for (const r of rows) console.log(`  ${r.component}\n      ${r.note}`)
  const total = Object.values(B).reduce((n, r) => n + Object.keys(r).length, 0)
  console.log(
    `\n${rows.length === 0 ? '✓' : '✗'} ${total} elementos, ${rows.length} con diferencias`,
  )
  process.exit(rows.length === 0 ? 0 : 1)
}

// `measure.mjs <label>` captures; `measure.mjs compare <a> <b>` diffs. The
// first argument is the label, not a mode — the mode is inferred from its value,
// so `measure.mjs baseline` labels the capture "baseline" instead of silently
// writing to a default one.
const argv = process.argv.slice(2)
if (argv[0] === 'compare') compare(argv[1], argv[2])
else await capture(argv[0] ?? 'current')
