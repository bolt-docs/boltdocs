/**
 * Verifies @bdocs/theme-neutral's native CSS in a real browser.
 *
 * The docs site runs its own Tailwind theme, so no existing suite ever renders
 * the neutral theme's stylesheet — which is exactly why the old `neutral.css`
 * could sit there unloaded and nobody would notice. This loads the built CSS
 * into a bare page with no bundler and no Tailwind, and asserts the tokens
 * resolve into computed values.
 *
 * Reads `getComputedStyle`, not the stylesheet source, because a rule can be
 * present and still lose the cascade.
 *
 * The central check is not "does the token have the value I wrote" but "does
 * overriding the token move the element". A stylesheet full of correct literals
 * and one wired to tokens look identical until someone rethemes it, and only the
 * second one is a theme.
 */
const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')

const rootRequire = createRequire(
  path.resolve(__dirname, '../../../..', 'package.json'),
)
const { chromium } = rootRequire('playwright')

const FIXTURE = `file://${path.resolve(__dirname, 'fixture.html')}`

function stageStyles() {
  const dist = path.resolve(__dirname, '../../dist/styles')
  const staged = path.resolve(__dirname, 'styles')
  if (!fs.existsSync(dist)) {
    console.error(
      `✗ ${dist} no existe. Ejecuta el build del paquete antes:\n    pnpm --filter @bdocs/theme-neutral build`,
    )
    process.exit(1)
  }
  fs.rmSync(staged, { recursive: true, force: true })
  fs.cpSync(dist, staged, { recursive: true })
  return staged
}

/**
 * Relative luminance, for contrast-direction checks.
 *
 * Accepts `rgb()`, `rgba()` and `#hex`, because the two colours being compared
 * come from different places: a token's declared value is often still hex while
 * a computed one is always `rgb()`. Only the direction matters here, so alpha is
 * ignored rather than composited.
 */
function luminance(color) {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color)
  const parts = hex
    ? [1, 3, 5].map((i) => parseInt(hex[1].slice(i - 1, i + 1), 16))
    : color.match(/\d+/g).slice(0, 3).map(Number)
  return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
}

const probe = () => {
  const cs = (sel) => getComputedStyle(document.querySelector(sel))
  const root = getComputedStyle(document.documentElement)
  return {
    canvas: root.getPropertyValue('--bdocs-canvas').trim(),
    surface: root.getPropertyValue('--bdocs-surface').trim(),
    ink: getComputedStyle(document.querySelector('.bdocs-root')).color,
    faint: root.getPropertyValue('--bdocs-ink-faint').trim(),
    duration: root.getPropertyValue('--bdocs-duration').trim(),
    privateSurface: root.getPropertyValue('--_bdocs-surface').trim(),
    themedColor: cs('.bdocs-root').color,
    themedFontFamily: cs('.bdocs-root').fontFamily,
    themedBackground: cs('.bdocs-root').backgroundColor,
    navDisplay: cs('.bdocs-page-nav').display,
    navColumns: cs('.bdocs-page-nav').gridTemplateColumns,
    navBorderTop: `${cs('.bdocs-page-nav').borderTopWidth} ${cs('.bdocs-page-nav').borderTopStyle}`,
    cardBorder: `${cs('.bdocs-page-nav__card').borderTopWidth} ${cs('.bdocs-page-nav__card').borderTopStyle}`,
    cardRadius: cs('.bdocs-page-nav__card').borderTopLeftRadius,
    cardBackground: cs('.bdocs-page-nav__card').backgroundColor,
    cardPadding: cs('.bdocs-page-nav__card').paddingTop,
    cardHeight: cs('.bdocs-page-nav__card').getPropertyValue('height'),
    titleFontSize: cs('.bdocs-page-nav__title').fontSize,
    titleLineHeight: cs('.bdocs-page-nav__title').lineHeight,
    titleColor: cs('.bdocs-page-nav__title').color,
    titleTransform: cs('.bdocs-page-nav__title').textTransform,
    iconBox: `${cs('.bdocs-page-nav__icon').width} ${cs('.bdocs-page-nav__icon').height}`,
  }
}

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

async function main() {
  const staged = stageStyles()
  console.log(`stylesheet bajo prueba: ${path.relative(process.cwd(), staged)}`)

  let browser
  try {
    browser = await chromium.launch()
  } catch (err) {
    if (/Executable doesn't exist/i.test(String(err))) {
      console.error(
        '\n✗ Falta el navegador de Playwright. Instalalo una vez:\n    pnpm exec playwright install chromium',
      )
      process.exit(1)
    }
    throw err
  }

  const results = {}
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await page.goto(FIXTURE)
  await settle(page)
  results.base = await page.evaluate(probe)

  // The test that matters: retint by overriding a public token, and confirm the
  // rules follow. This is the whole contract of a token layer, and it is the one
  // thing a stylesheet full of correct hex values passes by accident.
  results.retheme = await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent =
      ':root { --bdocs-surface: rgb(1, 2, 3); --bdocs-ink: rgb(4, 5, 6); }'
    document.head.append(style)
    const card = document.querySelector('.bdocs-page-nav__card')
    const root = document.querySelector('.bdocs-root')
    return {
      cardBackground: getComputedStyle(card).backgroundColor,
      rootColor: getComputedStyle(root).color,
    }
  })

  // Narrow viewport: the grid must collapse below its breakpoint. Asserting only
  // the wide case would pass on a grid that never collapsed at all.
  const narrow = await browser.newPage({
    viewport: { width: 380, height: 900 },
    reducedMotion: 'reduce',
  })
  await narrow.goto(FIXTURE)
  results.narrow = await narrow.evaluate(probe)

  await browser.close()

  const b = results.base
  const fail = []
  const check = (name, ok, detail) => {
    if (!ok) fail.push(`${name} — ${detail}`)
  }

  check('ink resolves to a colour', /^rgb/.test(b.ink), b.ink)
  check('canvas token is declared', b.canvas.length > 0, b.canvas)
  check('surface token is declared', b.surface.length > 0, b.surface)

  // The private layer must derive from the public one, or overriding
  // --bdocs-surface would not reach the rules.
  check(
    'private --_bdocs-surface derives from public --bdocs-surface',
    b.privateSurface === b.surface,
    `${b.privateSurface} != ${b.surface}`,
  )
  check(
    'overriding --bdocs-surface moves the card',
    results.retheme.cardBackground === 'rgb(1, 2, 3)',
    results.retheme.cardBackground,
  )
  check(
    'overriding --bdocs-ink moves the root',
    results.retheme.rootColor === 'rgb(4, 5, 6)',
    results.retheme.rootColor,
  )

  // Resolved values, so a rule is proven to have applied.
  check(
    'card border-width resolves',
    b.cardBorder === '1px solid',
    b.cardBorder,
  )
  check('card radius is 16px', b.cardRadius === '16px', b.cardRadius)
  check('card padding is 20px', b.cardPadding === '20px', b.cardPadding)
  check('nav is a grid', b.navDisplay === 'grid', b.navDisplay)
  check(
    'nav top border resolves',
    b.navBorderTop === '1px solid',
    b.navBorderTop,
  )
  check(
    'title is uppercased',
    b.titleTransform === 'uppercase',
    b.titleTransform,
  )

  // The measurements `scripts/visual/measure-pagenav.mjs` recorded against the
  // Tailwind build. If these move, the UI moved.
  check('title is 12px', b.titleFontSize === '12px', b.titleFontSize)
  check(
    'title line-height is 16px',
    b.titleLineHeight === '16px',
    b.titleLineHeight,
  )
  check('icon is 24x24', b.iconBox === '24px 24px', b.iconBox)

  // The caption alpha has to be on the colour. Faded with `opacity` instead, the
  // icon inside the element would fade too and the value here would still pass.
  check(
    'title colour carries its own alpha',
    /^rgba\(\d+, \d+, \d+, 0\.6\)$/.test(b.titleColor),
    b.titleColor,
  )
  check(
    'caption ink is lighter than body ink',
    luminance(b.titleColor) < luminance(b.ink),
    `${b.titleColor} vs ${b.ink}`,
  )

  check(
    'theme font stack applies inside .bdocs-root',
    b.themedFontFamily.includes('Segoe UI'),
    b.themedFontFamily,
  )

  const wide = b.navColumns.split(' ').filter(Boolean).length
  const narrowCols = results.narrow.navColumns.split(' ').filter(Boolean).length
  check('nav is two columns at 40rem+', wide === 2, b.navColumns)
  check(
    'nav collapses to one column below it',
    narrowCols === 1,
    results.narrow.navColumns,
  )

  check(
    'reduced motion collapses the duration token',
    b.duration === '0ms',
    b.duration,
  )

  console.log(JSON.stringify(results, null, 2))
  if (fail.length > 0) {
    console.error(`\n✗ ${fail.length} comprobacion(es) fallida(s):`)
    for (const f of fail) console.error('  - ' + f)
    process.exit(1)
  }
  console.log(
    `\n✓ 18 comprobaciones: el CSS nativo resuelve sin Tailwind y la capa publica gobierna las reglas`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
