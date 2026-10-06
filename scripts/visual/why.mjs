/**
 * Diagnoses which cascade rule is winning on a given element.
 *
 * Reads the cascade the way the browser does — `getMatchedCSSRules` is gone, so
 * every stylesheet is walked including `@import`ed ones and every rule that
 * matches is listed in source order — and reports, for each property, the last
 * rule that set it. The winner is the rule with the highest (specificity, source
 * order); everything else is a candidate that lost.
 *
 * Usage: node scripts/visual/why.mjs <url> <selector> [property]
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname } from 'node:path'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const rootRequire = createRequire(
  resolve(fileURLToPath(import.meta.url), '../../package.json'),
)
const { chromium } = rootRequire('playwright')

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..')
const SITE = join(ROOT, 'docs/dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const [url, selector, ...props] = process.argv.slice(2)
if (!url || !selector) {
  console.error('uso: why.mjs <path> <selector> [property...]')
  process.exit(2)
}

const server = createServer((req, res) => {
  const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = join(SITE, pathname)
  if (!existsSync(file) || !extname(file))
    file = `${file.replace(/\/$/, '')}.html`
  if (!existsSync(file)) file = join(SITE, 'index.html')
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(res)
})
const PORT = 5293
await new Promise((done) => server.listen(PORT, done))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.route('**', (route) => {
  const u = route.request().url()
  if (u.startsWith(`http://localhost:${PORT}`) || u.startsWith('data:'))
    return route.continue()
  return route.abort()
})
await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'load' })

const wanted =
  props.length > 0
    ? props
    : ['color', 'font-size', 'font-weight', 'display', 'visibility']

const report = await page.evaluate(
  ({ selector, wanted }) => {
    const el = document.querySelector(selector)
    if (!el) return { error: `sin elemento para ${selector}` }

    // Every rule that matches, in cascade order, across imported sheets too.
    const matched = []
    let order = 0
    const walk = (rules, sheetHref) => {
      for (const rule of rules) {
        order += 1
        if (rule.cssRules && rule.constructor.name === 'CSSImportRule') {
          walk(rule.styleSheet.cssRules, rule.styleSheet.href ?? sheetHref)
          continue
        }
        if (!rule.selectorText) continue
        try {
          if (!el.matches(rule.selectorText)) continue
        } catch {
          continue
        }
        matched.push({
          selector: rule.selectorText,
          sheet: sheetHref ? sheetHref.split('/').pop() : 'inline',
          order,
          style: rule.style.cssText,
        })
      }
    }
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules, sheet.href)
      } catch {
        /* cross-origin sheet: not readable, and not one of ours */
      }
    }

    // Specificity, computed rather than guessed. `:where()` contributes zero,
    // which is the whole point here — a `:where()` rule ties with the utilities
    // it is trying to beat and wins on source order alone.
    const specificity = (selectorText) => {
      const s = selectorText.replace(
        /::?(before|after|first-line|first-letter)\b/g,
        '',
      )
      const ids = (s.match(/#[\w-]+/g) ?? []).length
      const parts =
        s.match(
          /(?<!:)(:\w[\w-]*(\([^)]*\))?)|(\.[\w-]+)|(\[[^\]]*\])|(\b[a-z]+)/gi,
        ) ?? []
      let classes = 0
      let pseudos = 0
      for (const p of parts) {
        if (p.startsWith('.')) classes += 1
        else if (p.startsWith('[')) classes += 1
        else if (p.startsWith(':')) {
          // `:where()` is explicitly zero. `:is()` takes its argument's max.
          if (p.startsWith(':where')) continue
          if (
            p.startsWith(':is') ||
            p.startsWith(':not') ||
            p.startsWith(':has')
          ) {
            const inner = p.replace(/^:\w+\(/, '').replace(/\)$/, '')
            const innerSpec = specificity(inner)
            classes += innerSpec[0]
            pseudos += innerSpec[1]
            continue
          }
          pseudos += 1
        } else classes += 1
      }
      return [classes, pseudos, ids]
    }

    const compare = (a, b) => {
      for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i]
      return 0
    }

    const results = []
    for (const prop of wanted) {
      const candidates = matched
        .filter(
          (m) =>
            m.style && new RegExp(`(^|;)\\s*${prop}\\s*:`).test(`;${m.style}`),
        )
        .map((m) => ({ ...m, spec: specificity(m.selector) }))
        .sort((a, b) => compare(a.spec, b.spec) || a.order - b.order)
      const winner = candidates.at(-1)
      results.push({
        property: prop,
        computed: getComputedStyle(el).getPropertyValue(prop),
        candidates: candidates.length,
        winner: winner
          ? {
              selector: winner.selector,
              sheet: winner.sheet,
              spec: winner.spec.join('-'),
              declaration: winner.style,
            }
          : null,
      })
    }
    return { selector, class: el.className, tag: el.tagName, results }
  },
  { selector, wanted },
)

await browser.close()
server.close()

console.log(JSON.stringify(report, null, 2))
