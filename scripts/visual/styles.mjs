/**
 * Dumps the computed styles of a fixed set of selectors for every page.
 *
 * Pixel diffs answer "did anything change", which is a coarse question. When a
 * conversion is nearly right, they answer "yes, 2%" and leave you to guess which
 * two percent. This answers "which property, on which element, went from what to
 * what", so a near-miss is a two-line fix instead of a screenshot hunt.
 *
 * The selectors are components, not pages: the same conversion mistake shows up
 * on every page that renders the component, and listing one page per component
 * keeps the report readable.
 *
 * Usage:
 *   node scripts/visual/styles.mjs <label>    # writes .visual/<label>.styles.json
 *   node scripts/visual/styles.mjs compare <a> <b>
 */
import { createServer } from 'node:http'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
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
const SHOTS = join(ROOT, '.visual')

/** Properties worth comparing: the ones a utility class actually sets. */
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
  'padding-inline',
  'margin',
  'margin-top',
  'margin-bottom',
  'width',
  'max-width',
  'min-width',
  'height',
  'overflow',
  'color',
  'background-color',
  'border-width',
  'border-radius',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration-line',
  'opacity',
  'z-index',
  'visibility',
  'white-space',
  'text-overflow',
  'box-shadow',
  'flex-shrink',
  'flex-grow',
]

/**
 * One entry per component, each naming the selector that proves it rendered.
 *
 * If a selector matches nothing the entry records `null` rather than being
 * skipped, because "this component stopped rendering" is a bigger regression
 * than any colour change and must not look like an absence of data.
 */
const TARGETS = [
  // Selectors are structural, not class-based.
  //
  // The conversion replaces class names — `bg-surface p-5 rounded-2xl` becomes a
  // `.bdocs-page-nav__card` rule — so any selector naming a class measures one
  // version and misses the other. `nav[aria-label="Pagination"]` exists in both
  // and means the same thing in both, which is the only way a before/after
  // comparison can be about style rather than about markup.
  {
    name: 'shell root',
    selector: '.bdocs-root, .boltdocs-shell-content, body > div',
  },
  { name: 'layout body', selector: 'nav[aria-label="Pagination"]' },
  { name: 'layout content', selector: 'main, .boltdocs-content' },
  { name: 'page column', selector: '.boltdocs-page > div, .bdocs-page > div' },
  { name: 'page padded', selector: '.boltdocs-page' },
  { name: 'page title', selector: 'main h1, .boltdocs-page h1' },
  { name: 'page description', selector: 'main h1 + p' },
  {
    name: 'page meta row',
    selector: '.boltdocs-page hr, .boltdocs-page > div:first-child',
  },
  { name: 'pagenav wrapper', selector: 'nav[aria-label="Pagination"]' },
  { name: 'pagenav root', selector: 'nav[aria-label="Pagination"]' },
  { name: 'pagenav card', selector: 'nav[aria-label="Pagination"] > a' },
  {
    name: 'pagenav card body',
    selector: 'nav[aria-label="Pagination"] > a > :first-child',
  },
  {
    name: 'pagenav title',
    selector: 'nav[aria-label="Pagination"] > a > :first-child > :first-child',
  },
  {
    name: 'pagenav label',
    selector: 'nav[aria-label="Pagination"] > a > :first-child > :last-child',
  },
  {
    name: 'pagenav icon',
    selector: 'nav[aria-label="Pagination"] > a > :last-child',
  },
  {
    name: 'breadcrumbs',
    selector: 'nav[aria-label*="readcrumb"], ol:has(> li > a[href="/"])',
  },
  {
    name: 'breadcrumb item',
    selector: 'ol > li, nav[aria-label*="readcrumb"] > *',
  },
  { name: 'breadcrumb link', selector: 'ol > li > a, ol > li > span > a' },
  {
    name: 'breadcrumb separator',
    selector: 'ol > li > span, ol > li > svg, ol > li > *:not(a)',
  },
  { name: 'navbar', selector: 'header' },
  { name: 'navbar links', selector: 'header nav' },
  { name: 'sidebar', selector: 'aside, body nav:not([aria-label])' },
  { name: 'toc', selector: 'nav[aria-label="On this page"]' },
  { name: 'toc link', selector: 'nav[aria-label="On this page"] a' },
]

const PAGES = [
  'docs/guides/getting-started/installation.html',
  'docs/components/layout/page-nav.html',
  'docs/components/layout/breadcrumbs.html',
  'docs/es/guides/getting-started/installation.html',
  'index.html',
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

function siteBase() {
  return (
    readFileSync(join(ROOT, 'docs/boltdocs.config.ts'), 'utf-8').match(
      /base:\s*'([^']+)'/,
    )?.[1] ?? '/'
  )
}

/** Same multi-candidate resolution as the screenshot harness; see the note there. */
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
  const port = 5297
  const base = siteBase()
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    const file = resolveFile(url, base)
    if (!file) {
      res.writeHead(404)
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
  for (const rel of PAGES) {
    if (!existsSync(join(SITE, rel))) continue
    await page.goto(`http://localhost:${port}/${rel}`, {
      waitUntil: 'load',
      timeout: 120_000,
    })
    await page.evaluate(() =>
      Promise.race([
        document.fonts.ready,
        new Promise((d) => setTimeout(d, 2000)),
      ]),
    )
    for (const target of TARGETS) {
      const row = await page.evaluate(
        ({ selector, props }) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const cs = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          const values = {}
          for (const p of props) values[p] = cs.getPropertyValue(p)
          // Geometry as a separate signal: `padding: 1rem 2rem` and the longhand
          // set can disagree about ordering without either looking wrong.
          return {
            box: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            values,
          }
        },
        { selector: target.selector, props: PROPS },
      )
      out[`${rel} :: ${target.name}`] = row
    }
  }

  await browser.close()
  server.close()

  mkdirSync(SHOTS, { recursive: true })
  const file = join(SHOTS, `${label}.styles.json`)
  writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`)
  const matched = Object.values(out).filter(Boolean).length
  console.log(
    `✓ ${label}: ${matched} selectores medidos de ${Object.keys(out).length} en ${file}`,
  )
  return out
}

function compare(a, b) {
  const A = JSON.parse(readFileSync(join(SHOTS, `${a}.styles.json`), 'utf-8'))
  const B = JSON.parse(readFileSync(join(SHOTS, `${b}.styles.json`), 'utf-8'))
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort()
  const rows = []
  for (const key of keys) {
    const x = A[key]
    const y = B[key]
    if (!x || !y) {
      rows.push({
        key,
        note: x ? 'solo en A (desaparecio)' : 'solo en B (aparecio)',
      })
      continue
    }
    const props = []
    if (x.box !== y.box) props.push(`box ${x.box} -> ${y.box}`)
    for (const p of PROPS) {
      if (x.values[p] !== y.values[p])
        props.push(`${p}: ${x.values[p]} -> ${y.values[p]}`)
    }
    if (props.length > 0) rows.push({ key, note: props.join('; ') })
  }
  for (const r of rows) console.log(`  ${r.key}\n      ${r.note}`)
  console.log(
    `\n${rows.length === 0 ? '✓' : '✗'} ${keys.length} selectores comparados, ${rows.length} con diferencias`,
  )
  process.exit(rows.length === 0 ? 0 : 1)
}

const [mode, ...args] = process.argv.slice(2)
if (mode === 'capture') await capture(args[0])
else if (mode === 'compare') compare(args[0], args[1])
else {
  console.error('uso: styles.mjs <label> | styles.mjs compare <a> <b>')
  process.exit(2)
}
