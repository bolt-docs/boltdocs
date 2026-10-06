/**
 * Measures the pagination card and each of its parts, precisely.
 *
 * Exists because the styles probe's structural selectors land on the icon rather
 * than the title when a card's first child is the icon, which made three
 * readings useless and sent me guessing at combinations that added up to the
 * right total for the wrong reasons. This names the parts by their class when
 * present and by structure otherwise, and prints every box so the arithmetic can
 * be checked instead of inferred.
 *
 * Usage: node scripts/visual/measure-pagenav.mjs <label>
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const rootRequire = createRequire(
  resolve(fileURLToPath(import.meta.url), '../../../package.json'),
)
const { chromium } = rootRequire('playwright')

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..')
const SITE = join(ROOT, 'docs/dist')
const PAGE = 'docs/components/layout/page-nav.html'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function siteBase() {
  return (
    readFileSync(join(ROOT, 'docs/boltdocs.config.ts'), 'utf-8').match(
      /base:\s*'([^']+)'/,
    )?.[1] ?? '/'
  )
}

const label = process.argv[2]
if (!label) {
  console.error('uso: measure-pagenav.mjs <label>')
  process.exit(2)
}

const port = 5295
const base = siteBase()
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  const stripped = url.startsWith(base) ? url.slice(base.length) || '/' : url
  let file = null
  for (const candidate of [join(SITE, url), join(SITE, stripped)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      file = candidate
      break
    }
  }
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
await page.goto(`http://localhost:${port}/${PAGE}`, {
  waitUntil: 'load',
  timeout: 120_000,
})
await page.evaluate(() =>
  Promise.race([document.fonts.ready, new Promise((d) => setTimeout(d, 2000))]),
)

const out = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Pagination"]')
  if (!nav) return { error: 'no hay nav de paginacion' }
  const cards = [...nav.querySelectorAll('a')]
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className : '',
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      marginBottom: cs.marginBottom,
      color: cs.color,
    }
  }
  return {
    nav: box(nav),
    cards: cards.map((card) => {
      const kids = [...card.children]
      // In both markups a card is [content, icon] or [icon, content]; the icon is
      // the child holding an <svg>. Reported by role so the two layouts line up.
      const icon = kids.find((k) => k.querySelector('svg')) ?? kids.at(-1)
      const content = kids.find((k) => k !== icon)
      return {
        card: box(card),
        content: box(content),
        contentChildren: content ? [...content.children].map(box) : [],
        icon: box(icon),
      }
    }),
  }
})

await browser.close()
server.close()

console.log(`=== ${label} ===`)
console.log(JSON.stringify(out, null, 1))
