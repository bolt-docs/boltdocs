import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(
  'http://localhost:5173/docs/guides/getting-started/installation',
  {
    waitUntil: 'networkidle',
  },
)
await page.waitForTimeout(600)

const info = await page.evaluate(() => {
  const sel = (s) => document.querySelector(s)
  const style = (el) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      padding: cs.padding,
      borderTop:
        cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      borderRight:
        cs.borderRightWidth +
        ' ' +
        cs.borderRightStyle +
        ' ' +
        cs.borderRightColor,
      borderBottom:
        cs.borderBottomWidth +
        ' ' +
        cs.borderBottomStyle +
        ' ' +
        cs.borderBottomColor,
      borderLeft:
        cs.borderLeftWidth +
        ' ' +
        cs.borderLeftStyle +
        ' ' +
        cs.borderLeftColor,
      bg: cs.backgroundColor,
      display: cs.display,
    }
  }
  const out = {}
  out.viewport = { w: innerWidth, h: innerHeight }
  out.header = style(document.querySelector('header'))
  out.navbarContent = style(
    document.querySelector('.boltdocs-navbar > div') ||
      document.querySelector('header > div'),
  )
  out.tabsRow = style(
    document.querySelector(
      '.boltdocs-navbar [class*="border-b"], header [class*="border-b"]',
    ),
  )
  out.tablist = style(document.querySelector('[role="tablist"]'))
  out.tab0 = style(
    document.querySelector('[role="tablist"] a') ||
      document.querySelector('[role="tablist"] [role="tab"]'),
  )
  out.aside = style(document.querySelector('aside'))
  out.asideContent = style(
    document.querySelector('aside [class*="overflow-y"]') ||
      document.querySelector('aside nav'),
  )
  out.asideLink = style(document.querySelector('aside a'))
  out.asideActiveLink = style(
    document.querySelector(
      'aside a[aria-current="page"], aside a[class*="bg-primary"]',
    ),
  )
  out.asideGroupHeader = style([...document.querySelectorAll('aside h4')][0])
  out.toc = style(document.querySelector('[class*="w-toc"], nav[aria-hidden]'))
  out.main = style(document.querySelector('main'))
  out.contentMdx = style(
    document.querySelector('.boltdocs-content') ||
      document.querySelector('main > div'),
  )
  out.breadcrumbsRow = style(document.querySelector('main [class*="mb-6"]'))
  out.headerTitle = style(document.querySelector('main h1'))
  out.headerDesc = style(
    document.querySelector('main h1 + p') ||
      document.querySelector('main header p'),
  )
  out.prose = style(document.querySelector('.bdocs-prose'))
  out.searchTrigger = style(
    document.querySelector('header button[class*="rounded-lg"]'),
  )
  out.i18nButton = style(
    [...document.querySelectorAll('header button')].find(
      (b) => b.textContent.includes('Eng') || b.textContent.includes('Esp'),
    ),
  )
  out.copyMarkdown = style(
    [...document.querySelectorAll('main button')].find((b) =>
      b.textContent.includes('Copy Markdown'),
    ),
  )
  out.feedback = style(document.querySelector('main [class*="mt-12"]'))
  // scrollbar presence on aside
  const asideNav = document.querySelector('aside')
  out.asideScrollbar = asideNav
    ? asideNav.scrollHeight > asideNav.clientHeight
    : null
  return out
})

console.log(JSON.stringify(info, null, 2))
await browser.close()
