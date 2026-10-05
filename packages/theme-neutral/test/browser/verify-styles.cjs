/**
 * Verifies @bdocs/theme-neutral's native CSS in a real browser.
 *
 * The docs site runs its own Tailwind theme, so no existing suite ever renders
 * the neutral theme's stylesheet — which is exactly why the old `neutral.css`
 * could sit there unloaded and nobody would notice. This loads the built CSS
 * into a bare page with no bundler and no Tailwind, and asserts the tokens
 * resolve into computed values.
 *
 * Reads `getComputedStyle`, not the stylesheet source: a rule can be present and
 * still lose the cascade, and only computed values settle that.
 */
const fs = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')

// Playwright is a devDependency of the repository root, not of this package:
// the a11y suite that owns the browsers lives there too. Resolving it from the
// root keeps this check runnable without adding an install step to a package
// whose tests otherwise need nothing.
const rootRequire = createRequire(
  path.resolve(__dirname, '../../../..', 'package.json'),
)
const { chromium } = rootRequire('playwright')

const FIXTURE = `file://${path.resolve(__dirname, 'fixture.html')}`

/**
 * Stages the built stylesheet next to the fixture.
 *
 * The fixture loads `styles/index.css` the way a site would — a plain relative
 * `@import` chain with no bundler — so it needs the real published layout, not
 * the sources. Copied from `dist` rather than pointed at so the check exercises
 * the `fs.cpSync` step in the build; a stylesheet that is built but never copied
 * is precisely how the old `neutral.css` shipped unloaded.
 */
function stageStyles() {
  const dist = path.resolve(__dirname, '../../dist/styles')
  const staged = path.resolve(__dirname, 'styles')
  if (!fs.existsSync(dist)) {
    console.error(
      `✗ ${dist} no existe. Ejecuta el build del paquete antes de esta comprobacion:\n    pnpm --filter @bdocs/theme-neutral build`,
    )
    process.exit(1)
  }
  fs.rmSync(staged, { recursive: true, force: true })
  fs.cpSync(dist, staged, { recursive: true })
  return staged
}

/**
 * Waits for transitions to finish before reading computed styles.
 *
 * Not optional. `getComputedStyle` returns the *current animated* value, and the
 * cards transition `background-color` over `--bdocs-duration`. Reading straight
 * after flipping `data-theme` returns the pre-transition colour and looks
 * exactly like a theme that ignores dark mode.
 */
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((done) => {
        const running = document
          .getAnimations()
          .filter((a) => a.playState === 'running')
        if (running.length === 0) return done()
        Promise.allSettled(running.map((a) => a.finished)).then(() => done())
      }),
  )
}

/** Relative luminance of an `rgb(r, g, b)` string, for contrast-direction checks. */
function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const probe = () => {
  const cs = (sel) => getComputedStyle(document.querySelector(sel))
  const root = getComputedStyle(document.documentElement)
  const themed = cs('.bdocs-root')
  const card = cs('.bdocs-page-nav__card')
  return {
    bg: root.getPropertyValue('--bdocs-bg').trim(),
    duration: root.getPropertyValue('--bdocs-duration').trim(),
    privateSurface: root.getPropertyValue('--_bdocs-surface').trim(),
    themedFontFamily: themed.fontFamily,
    themedBackground: themed.backgroundColor,
    navDisplay: cs('.bdocs-page-nav').display,
    navColumns: cs('.bdocs-page-nav').gridTemplateColumns,
    navBorderTop: `${cs('.bdocs-page-nav').borderTopWidth} ${cs('.bdocs-page-nav').borderTopStyle}`,
    cardBorder: `${card.borderTopWidth} ${card.borderTopStyle}`,
    cardRadius: card.borderTopLeftRadius,
    cardBackground: card.backgroundColor,
    cardColor: card.color,
    cardPadding: card.paddingTop,
    titleTransform: cs('.bdocs-page-nav__title').textTransform,
    titleColor: cs('.bdocs-page-nav__title').color,
  }
}

async function main() {
  const staged = stageStyles()
  console.log(`stylesheet bajo prueba: ${path.relative(process.cwd(), staged)}`)

  let browser
  try {
    browser = await chromium.launch()
  } catch (err) {
    // Almost always a missing browser binary rather than a real failure. Say
    // which, so it is not mistaken for the theme being broken.
    if (/Executable doesn't exist/i.test(String(err))) {
      console.error(
        '\n\u2717 Falta el navegador de Playwright. Instalalo una vez:\n    pnpm exec playwright install chromium\n\n' +
          'La comprobacion necesita un navegador de verdad: leer el CSS no demuestra\n' +
          'que gane la cascada, que es justo el fallo que se esconde aqui.',
      )
      process.exit(1)
    }
    throw err
  }
  const results = {}

  // Light and dark, at the default viewport.
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    })
    await page.goto(FIXTURE)
    if (scheme === 'dark') {
      await page.evaluate(() =>
        document.documentElement.setAttribute('data-theme', 'dark'),
      )
      await settle(page)
    }
    results[scheme] = await page.evaluate(probe)
    await page.close()
  }

  // Narrow viewport: the grid must collapse to one column below the 40rem
  // breakpoint. Asserting only the wide case would pass on a grid that never
  // collapsed at all.
  {
    const page = await browser.newPage({
      viewport: { width: 380, height: 900 },
    })
    await page.goto(FIXTURE)
    results.narrow = await page.evaluate(probe)
    await page.close()
  }

  // Reduced motion: the token layer collapses durations to 0 rather than each
  // rule having to be guarded.
  {
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.goto(FIXTURE)
    results.reducedMotion = await page.evaluate(probe)
    await page.close()
  }

  await browser.close()

  const light = results.light
  const dark = results.dark
  const fail = []
  const check = (name, ok, detail) => {
    if (!ok) fail.push(`${name} — ${detail}`)
  }

  check('light --bdocs-bg is white', light.bg === '#ffffff', light.bg)
  check('dark --bdocs-bg is dark', dark.bg === '#0b0f19', dark.bg)

  // The real assertion: a rule that consumes a token has to follow the token
  // when it changes. Token resolution alone would pass even if no rule used it.
  check(
    'card surface follows --bdocs-bg into dark mode',
    dark.cardBackground === 'rgb(11, 15, 25)',
    `light=${light.cardBackground} dark=${dark.cardBackground}`,
  )
  check(
    'root surface follows --bdocs-bg into dark mode',
    dark.themedBackground === 'rgb(11, 15, 25)',
    dark.themedBackground,
  )
  // Muted ink has to get *lighter* in dark mode, not merely change — a value
  // that inverts would read as a bug on a light background.
  check(
    'muted ink lightens for dark mode',
    luminance(dark.titleColor) > luminance(light.titleColor),
    `${light.titleColor} -> ${dark.titleColor}`,
  )

  // The private layer must derive from the public one, or overriding
  // --bdocs-bg would not reach the rules.
  check(
    'private --_bdocs-surface derives from public --bdocs-bg',
    light.privateSurface === light.bg,
    `${light.privateSurface} != ${light.bg}`,
  )
  check(
    'private layer still derives after the override',
    dark.privateSurface === dark.bg,
    `${dark.privateSurface} != ${dark.bg}`,
  )

  // A resolved px/rgb proves a rule applied, not just that the file loaded.
  check(
    'card border-width resolves',
    light.cardBorder === '1px solid',
    light.cardBorder,
  )
  check(
    'card radius resolves',
    parseFloat(light.cardRadius) > 8,
    light.cardRadius,
  )
  check(
    'card padding resolves',
    parseFloat(light.cardPadding) > 8,
    light.cardPadding,
  )
  check('nav is a grid', light.navDisplay === 'grid', light.navDisplay)
  check(
    'nav top border resolves',
    light.navBorderTop === '1px solid',
    light.navBorderTop,
  )
  check(
    'title is uppercased',
    light.titleTransform === 'uppercase',
    light.titleTransform,
  )
  check(
    'title colour is a colour',
    /^rgb/.test(light.titleColor),
    light.titleColor,
  )

  // Fonts prove the @import chain resolved: tokens.css arrives via index.css.
  check(
    'theme font stack applies inside .bdocs-root',
    light.themedFontFamily.includes('Segoe UI'),
    light.themedFontFamily,
  )

  const wideCols = light.navColumns.split(' ').filter(Boolean).length
  const narrowCols = results.narrow.navColumns.split(' ').filter(Boolean).length
  check('nav is two columns at 40rem+', wideCols === 2, light.navColumns)
  check(
    'nav collapses to one column below it',
    narrowCols === 1,
    results.narrow.navColumns,
  )

  check(
    'reduced motion collapses the duration token',
    results.reducedMotion.duration === '0ms',
    `${light.duration} -> ${results.reducedMotion.duration}`,
  )

  console.log(JSON.stringify(results, null, 2))
  if (fail.length > 0) {
    console.error(`\n✗ ${fail.length} comprobacion(es) fallida(s):`)
    for (const f of fail) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(
    `\n✓ 4 paginas, 17 comprobaciones: el CSS nativo resuelve sin Tailwind, y la capa publica gobierna las reglas`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
