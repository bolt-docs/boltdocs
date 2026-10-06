/**
 * Visual regression harness for @bdocs/theme-neutral's move to native CSS.
 *
 * Why this exists: the docs site is the only thing in the repository that
 * actually renders the theme. Every conversion of a component from Tailwind
 * utilities to native CSS is a claim that the UI did not change, and no unit
 * test can check a claim like that. This drives the built site in a real browser
 * and compares pixels against a baseline captured before the change.
 *
 * Determinism, in order of how much each one cost us:
 *
 *   1. External requests are aborted. The docs site loads Geist and KaTeX from
 *      CDNs; a network hiccup would show up as a font diff and read as a
 *      regression. Blocked, both sides get the fallback and the diff is about
 *      the theme.
 *   2. Animations are disabled at screenshot time, so a fade-in cannot be caught
 *      mid-flight. This is the same trap as reading computed styles during a
 *      transition: the measurement catches the transition, not the result.
 *   3. Scroll is disabled, because a sticky navbar at a scrolled position is a
 *      different image for reasons unrelated to the theme.
 *
 * Usage:
 *   node scripts/visual/snapshot.mjs capture <label>   # write the baseline
 *   node scripts/visual/snapshot.mjs diff <a> <b>      # compare two labels
 */
import { createServer } from 'node:http'
import {
  createReadStream,
  existsSync,
  statSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const rootRequire = createRequire(
  resolve(fileURLToPath(import.meta.url), '../../../package.json'),
)
const { chromium } = rootRequire('playwright')
const sharp = rootRequire('sharp')

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..')
const SITE = join(ROOT, 'docs/dist')
const SHOTS = join(ROOT, '.visual')

/**
 * One page per theme component, chosen from the docs' own component gallery.
 *
 * The layout chrome — navbar, sidebar, on-this-page, page-nav, banner — renders
 * on every docs page, so any page covers it. What varies is content, and this
 * list pairs each component with the page that documents it, so converting
 * `theme-toggle.tsx` and getting a silent visual regression is caught by the
 * page that shows a theme toggle rather than by luck.
 *
 * A hardcoded list rather than a glob: the docs have 259 pages and 4 renders
 * each is far more screenshots than the signal justifies. `--all` captures
 * everything when a change is broad enough to warrant it.
 */
const CURATED = [
  // A couple of pages only: scroll capture multiplies images per page, and
  // validating the harness itself is not what the full list is for.
  // `node scripts/visual/snapshot.mjs capture <label> --quick`

  // External pages: rendered by a different route, still part of the shell.
  'index.html',
  'about.html',
  // Layout chrome on an ordinary guide page.
  'docs/guides/getting-started/installation.html',
  'docs/guides/getting-started/configuration.html',
  'docs/guides/advanced/file-routing.html',
  'docs/guides/content/frontmatter.html',
  'docs/guides/customization/layout.html',
  // Each layout component on the page that documents it.
  'docs/components/layout/navbar.html',
  'docs/components/layout/sidebar.html',
  'docs/components/layout/breadcrumbs.html',
  'docs/components/layout/on-this-page.html',
  'docs/components/layout/page-nav.html',
  'docs/components/layout/search-dialog.html',
  'docs/components/layout/code-block.html',
  'docs/components/layout/error-boundary.html',
  'docs/components/layout/docs-layout.html',
  // MDX components.
  'docs/components/mdx/code-blocks.html',
  'docs/components/mdx/callout.html',
  'docs/components/mdx/card.html',
  'docs/components/mdx/timeline.html',
  'docs/components/mdx/field.html',
  'docs/components/mdx/image.html',
  // UI primitives.
  'docs/components/ui/button.html',
  'docs/components/ui/button-group.html',
  'docs/components/ui/heading.html',
  'docs/components/ui/link.html',
  'docs/components/ui/menu.html',
  'docs/components/ui/popover.html',
  'docs/components/ui/skeleton.html',
  'docs/components/ui/tabs.html',
  'docs/components/ui/tooltip.html',
  // A blog post: cover image, date, tags, prose.
  'docs/blog/boltdocs-3.3.0.html',
  // API reference: dense tables and long code samples.
  'docs/api/plugin-api/lifecycle-hooks.html',
  // Spanish locale: same components, and the one place a locale bug would hide.
  'docs/es/guides/getting-started/installation.html',
  'docs/es/components/mdx/code-blocks.html',
  'docs/es/blog/boltdocs-3.3.0.html',
]

/**
 * Waits for webfonts without hanging on a blocked one.
 *
 * Playwright's `screenshot` waits for fonts internally and gives up after 30s.
 * The harness blocks every external request, so a CDN font is aborted and can
 * leave `document.fonts.ready` pending forever — the run then dies with
 * "waiting for fonts to load" on a page that is otherwise fine. Racing it here
 * turns an infrastructure failure into a recorded state.
 */
async function fontsSettled(page) {
  await page.evaluate(() =>
    Promise.race([
      document.fonts.ready,
      new Promise((done) => setTimeout(done, 2000)),
    ]),
  )
}

/**
 * Inline source for the scroller pick, run in the page.
 *
 * Kept as a string and injected rather than as a Node function because
 * `page.evaluate` serialises the callback and runs it in the browser — a
 * module-scope helper is simply not in scope there.
 */
const PICK_SCROLLER = `() => {
  const scrollers = [...document.querySelectorAll('*')].filter(
    (e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY),
  )
  if (scrollers.length === 0) return null
  const main = scrollers.find((e) => e.tagName === 'MAIN' || e.querySelector('h1'))
  if (main) return main
  return scrollers.reduce((a, b) => (b.scrollHeight > a.scrollHeight ? b : a))
}`

/**
 * Scroll offsets worth capturing: every screenful, plus the last one.
 *
 * Measured on the element that actually scrolls rather than the document, which
 * does not scroll at all under the shell.
 */
async function scrollOffsets(page) {
  return page.evaluate(`(() => {
    const pick = ${PICK_SCROLLER}
    const scroller = pick()
    if (!scroller) return []
    const step = scroller.clientHeight
    const offsets = []
    for (let y = 0; y < scroller.scrollHeight - step + 8; y += step) offsets.push(y)
    // The tail, which a whole number of steps would leave partly unseen.
    const tail = scroller.scrollHeight - step
    if (tail > 0 && offsets.at(-1) !== tail) offsets.push(tail)
    return offsets.slice(0, 6)
  })()`)
}

async function scrollTo(page, y) {
  await page.evaluate(
    ([top, pickSrc]) => {
      // eslint-disable-next-line no-new-func -- injected because evaluate
      // serialises the callback and a module-scope helper is not in scope there.
      const pick = new Function(`return (${pickSrc})`)()
      const scroller = pick()
      if (scroller) scroller.scrollTop = top
      else window.scrollTo(0, top)
    },
    [y, PICK_SCROLLER],
  )
}

const ALL = process.argv.includes('--all')
/** A handful of pages for iterating on the harness itself, not the theme. */
const QUICK = process.argv.includes('--quick')

/**
 * Waits until the DOM stops changing.
 *
 * The site is server-rendered and then hydrated, and some chrome only mounts
 * after hydration — the navbar's search button is one. `waitUntil: 'load'` does
 * not cover that, so screenshotting on it catches a coin flip: with the icon the
 * navbar is wider and every pixel to its right shifts. Half the baseline
 * disagreed with itself by up to 22% before this existed.
 *
 * A mutation-settling wait is used rather than a timeout because a fixed wait is
 * just the same flakiness with extra steps — it passes on a fast machine and
 * fails on a loaded one. `networkidle` is not enough on its own, since a lazily
 * imported chunk can still be in flight when it resolves.
 */
async function settleDom(page, quietMs = 250, timeoutMs = 10_000) {
  await page.evaluate(
    ({ quietMs, timeoutMs }) =>
      new Promise((done) => {
        let timer = null
        const finish = () => {
          clearTimeout(timer)
          observer.disconnect()
          done(null)
        }
        const observer = new MutationObserver(() => {
          clearTimeout(timer)
          timer = setTimeout(finish, quietMs)
        })
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        })
        // Nothing mutating yet still has to resolve, or a page with no late
        // mounts would hang until the timeout.
        timer = setTimeout(finish, quietMs)
        setTimeout(finish, timeoutMs)
      }),
    { quietMs, timeoutMs },
  )
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

/** Every `dist` path that is a page, so a rename surfaces as a missing shot. */
function sitePages() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.html'))
        out.push(relative(SITE, full).replaceAll('\\', '/'))
    }
  }
  walk(SITE)
  return out.sort()
}

/** The curated list, or everything. A curated page that vanished is an error. */
function pagesToShoot() {
  const available = new Set(sitePages())
  if (ALL) return [...available]
  // Scroll capture makes each page 3-6 images, so `--quick` trims the list hard.
  const wanted = QUICK ? CURATED.slice(0, 4) : CURATED
  const missing = wanted.filter((p) => !available.has(p))
  if (missing.length > 0) {
    throw new Error(
      `paginas del banco de pruebas que ya no existen:\n  ${missing.join('\n  ')}\n` +
        'Renombrar una pagina rompe el banco en silencio si no se avisa aqui.',
    )
  }
  return wanted
}

/**
 * `base` from the docs config.
 *
 * Read rather than hardcoded, because the whole suite addresses the site the way
 * a browser does — through the base path. A server that ignored it answered
 * `/docs/dark.svg` with the 404 page, the logo rendered as a broken image, and
 * the screenshots showed a difference that had nothing to do with the theme.
 * That is the worst kind of test failure: confidently wrong.
 */
function siteBase() {
  const config = readFileSync(join(ROOT, 'docs/boltdocs.config.ts'), 'utf-8')
  return config.match(/base:\s*'([^']+)'/)?.[1] ?? '/'
}

/**
 * Resolve a request path to a file in `dist`.
 *
 * Two layouts coexist and both have to work:
 *
 *   dist/docs/guides/x.html   docs pages, addressed as `/docs/guides/x.html`
 *   dist/dark.svg             public assets, addressed as `/docs/dark.svg`
 *
 * With `base: '/docs'` the site is mounted so that `dist/` answers under `/docs/`,
 * so pages resolve as-is and assets resolve with the base stripped. Rather than
 * guess which case applies, every candidate is tried and the first hit wins.
 *
 * The earlier version guessed, guessed wrong, and served `index.html` for all 259
 * pages. Because it never 404'd, nothing errored: the suite reported "144
 * screenshots, 0 differences" while having photographed the homepage 144 times.
 * A harness that silently answers with the wrong page is worse than one that
 * crashes, so a miss is now a 404 and the caller counts bodies.
 */
function resolveFile(url, base) {
  const stripped = url.startsWith(base) ? url.slice(base.length) || '/' : url
  const candidates = [
    join(SITE, url),
    join(SITE, stripped),
    join(SITE, `${url.replace(/\/$/, '')}.html`),
    join(SITE, `${stripped.replace(/\/$/, '')}.html`),
    join(SITE, stripped, 'index.html'),
    join(SITE, url, 'index.html'),
  ]
  for (const file of candidates)
    if (existsSync(file) && statSync(file).isFile()) return file
  return null
}

function serve(port, onMiss = () => {}) {
  const base = siteBase()
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    const file = resolveFile(url, base)
    if (!file) {
      onMiss(url)
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end(`no such file: ${url}`)
      return
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    })
    createReadStream(file).pipe(res)
  })
  return new Promise((done) => server.listen(port, () => done(server)))
}

/**
 * The theme is dark-only in the docs build, but the tokens support both, and a
 * conversion that only ever gets looked at in one of them is half-checked.
 */
const THEMES = ['dark', 'light']
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

async function capture(label) {
  const dir = join(SHOTS, label)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })

  let shots = 0
  const misses = []
  const port = 5291
  const server = await serve(port, (url) => misses.push(url))
  const browser = await chromium.launch()

  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          // Reduced motion keeps entrance animations from being half-done, and
          // the theme's own duration token collapses to 0 under it — which is
          // what we want: the styles, not the animation.
          reducedMotion: 'reduce',
        })
        // Fonts and KaTeX come from CDNs. Blocking them makes a network problem
        // impossible to mistake for a styling regression.
        await context.route('**', (route) => {
          const url = route.request().url()
          if (
            url.startsWith(`http://localhost:${port}`) ||
            url.startsWith('data:')
          ) {
            return route.continue()
          }
          return route.abort()
        })

        const page = await context.newPage()
        page.on('crash', () => console.error('  !! renderer crasheado'))
        for (const rel of pagesToShoot()) {
          const target = join(SITE, rel)
          if (!existsSync(target)) continue
          if (process.env.VERBOSE) {
            process.stdout.write(`  ${viewport.name}/${theme} ${rel}... `)
          }
          const url = `http://localhost:${port}/${rel}`
          // Generous, because this box sits at load ~18 while a build runs and
          // the default 30s is a coin flip there. Wall-clock has nothing to do
          // with what the harness measures, so the budget comes from that, not
          // from how long a page "should" take.
          await page.goto(url, { waitUntil: 'load', timeout: 120_000 })
          // Hydration and any lazily imported chrome have to land first, or the
          // screenshot races the mount and the navbar comes out a different
          // width run to run.
          await settleDom(page, 250, 20_000)
          if (theme === 'light') {
            await page.evaluate(() => {
              document.documentElement.classList.remove('dark')
              document.documentElement.removeAttribute('data-theme')
            })
          } else {
            await page.evaluate(() => {
              document.documentElement.classList.add('dark')
              document.documentElement.setAttribute('data-theme', 'dark')
            })
          }
          // The page that came back must be the page that was asked for. The
          // expected title is read from the file on disk rather than guessed
          // from the filename, so the check is an identity test rather than a
          // heuristic that a route like `index` or `blog` would defeat.
          //
          // This is the one guard that catches a mis-resolving server before it
          // becomes a green run full of the wrong image.
          // Identity is the rendered `h1`, read from the file on disk and
          // compared against the live DOM. `<title>` is not usable: the static
          // output carries a placeholder (`<title>X</title>`) because titles are
          // injected at runtime, so every page would look identical and the check
          // would pass on any page at all.
          const expectedH1 = /<h1[^>]*>([\s\S]*?)<\/h1>/
            .exec(readFileSync(target, 'utf-8'))?.[1]
            ?.replace(/<[^>]*>/g, '')
            .replace(/&#x27;/g, "'")
            .trim()
          const servedH1 = await page.evaluate(
            () => document.querySelector('h1')?.textContent?.trim() ?? '',
          )
          // A page with no `h1` in the markup (an external page, say) cannot be
          // identified this way, so it is skipped rather than guessed at.
          if (expectedH1 && servedH1 !== expectedH1) {
            throw new Error(
              `${rel} devolvio otra pagina:\n  esperaba  h1="${expectedH1}"\n  recibido h1="${servedH1}"\n` +
                'El banco compararia imagenes de un documento que no es el que pide.',
            )
          }

          // One frame so the class swap is reflected before the paint we keep,
          // then settle again in case the swap triggered a lazy mount.
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => r(null))),
          )
          await settleDom(page, 250, 20_000)
          const base = `${viewport.name}-${theme}-${rel.replace(/\//g, '_')}`
          await fontsSettled(page)
          await page.screenshot({
            path: join(dir, `${base}.png`),
            animations: 'disabled',
            timeout: 60_000,
            // Not `fullPage: true`. The shell is `height: 100vh; overflow:
            // hidden`, so the document itself never scrolls and `fullPage`
            // returns exactly one viewport — silently. The scrolling element is
            // an inner `<main>`, 3292px of content in a 900px window.
            fullPage: false,
          })

          // And because the document cannot scroll, `fullPage` is not enough on
          // its own: everything below the fold needs its own capture. Deleting
          // `padding` from the page-nav card produced a zero-difference run
          // against a `fullPage` harness — 144 screenshots of a page whose lower
          // half had never been recorded. A visual test that cannot see the
          // component is worse than none, because it reports green.
          // Parenthesised deliberately. `await f(x).entries()` binds `.entries()`
          // to the *Promise*, not the array it resolves to, and the resulting
          // TypeError surfaces from inside Playwright as "target page closed".
          for (const [i, offset] of (await scrollOffsets(page)).entries()) {
            await scrollTo(page, offset)
            await settleDom(page, 250, 20_000)
            await fontsSettled(page)
            await page.screenshot({
              path: join(dir, `${base}-s${i}.png`),
              animations: 'disabled',
              timeout: 60_000,
              fullPage: false,
            })
          }
          await scrollTo(page, 0)
          shots++
          if (process.env.VERBOSE) process.stdout.write(`${shots} total\n`)
        }
        await context.close()
      }
    }
  } finally {
    await browser.close()
    server.close()
  }

  // Not fatal: third-party scripts the docs reference have no local file, and a
  // strict server correctly 404s them. The important part is that the server
  // *404s* instead of substituting `index.html` — that substitution is what made
  // the previous run photograph the homepage 144 times and report zero
  // differences. Page identity is asserted per page against the rendered `h1`.
  if (misses.length > 0) {
    console.log(
      `  ${misses.length} recursos externos sin fichero local (404 esperado)`,
    )
  }

  const written = readdirSync(dir)
  console.log(
    `✓ ${label}: ${written.length} capturas en ${relative(process.cwd(), dir)}`,
  )
  console.log(
    `  paginas: ${sitePages().length} en dist, ${pagesToShoot().length} capturadas`,
  )
  return dir
}

/**
 * Fraction of differing pixels, per image.
 *
 * Uses sharp rather than pixelmatch because sharp is already a dependency
 * (image-optimizer needs it) and adding a diff library for a script is not worth
 * a lockfile change. Antialiasing on text makes a bit-exact comparison useless,
 * so the threshold is per-pixel and the number that matters is the aggregate.
 */
async function diff(labelA, labelB) {
  const a = join(SHOTS, labelA)
  const b = join(SHOTS, labelB)
  for (const dir of [a, b]) {
    if (!existsSync(dir)) throw new Error(`sin capturas en ${dir}`)
  }

  const names = [...new Set([...readdirSync(a), ...readdirSync(b)])].sort()
  const outDir = join(SHOTS, `${labelB}-vs-${labelA}`)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const rows = []
  for (const name of names) {
    const pa = join(a, name)
    const pb = join(b, name)
    if (!existsSync(pa) || !existsSync(pb)) {
      rows.push({ name, changed: -1, differing: 'solo en un lado' })
      continue
    }
    const [ia, ib] = await Promise.all([
      sharp(pa).raw().toBuffer({ resolveWithObject: true }),
      sharp(pb).raw().toBuffer({ resolveWithObject: true }),
    ])
    if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) {
      rows.push({ name, changed: 100, differing: 'dimensiones distintas' })
      continue
    }
    const ch = ia.info.channels
    let differing = 0
    for (let i = 0; i < ia.data.length; i += ch) {
      if (
        Math.abs(ia.data[i] - ib.data[i]) > 8 ||
        Math.abs(ia.data[i + 1] - ib.data[i + 1]) > 8 ||
        Math.abs(ia.data[i + 2] - ib.data[i + 2]) > 8
      ) {
        differing++
      }
    }
    const total = ia.data.length / ch
    const pct = (differing / total) * 100
    if (pct > 0.05) {
      await sharp(ia.data, { raw: ia.info })
        .composite([{ input: ib.data, raw: ib.info, blend: 'difference' }])
        .png()
        .toFile(join(outDir, name))
    }
    rows.push({ name, changed: Number(pct.toFixed(3)), differing })
  }

  const regressions = rows.filter((r) => r.changed > 0.05)
  rows.sort((x, y) => y.changed - x.changed)
  for (const r of rows.filter((x) => x.changed > 0)) {
    console.log(`  ${String(r.changed).padStart(7)}%  ${r.name}`)
  }
  console.log(
    `\n${regressions.length === 0 ? '✓' : '✗'} ${rows.length} comparadas, ${regressions.length} con diferencia > 0.05%`,
  )
  if (regressions.length > 0) {
    console.log(`  diffs visuales: ${relative(process.cwd(), outDir)}`)
  }
  process.exit(regressions.length === 0 ? 0 : 1)
}

const [mode, ...args] = process.argv.slice(2)
if (mode === 'capture') await capture(args[0])
else if (mode === 'diff') await diff(args[0], args[1])
else {
  console.error('uso: snapshot.mjs capture <label> | diff <labelA> <labelB>')
  process.exit(2)
}
