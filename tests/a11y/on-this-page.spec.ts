import { test, expect } from '@playwright/test'

// Pages that previously shipped duplicate headings (e.g. `### Search` twice on
// the integrations index). The "On this page" TOC must list each heading once.
const PAGES = [
  '/docs/integrations',
  '/docs/integrations/seo',
  // Plugin pages moved under the `content` section when the docs were
  // reorganized; the old flat paths resolve to the not-found page, which has
  // no TOC and made this guard time out instead of asserting anything.
  '/docs/plugins/content/plugin-math',
  '/docs/plugins/content/plugin-rss',
  '/docs/plugins/content/plugin-llms-text',
  '/docs/guides/getting-started/cli',
  '/docs/es/guides/getting-started/cli',
  '/docs/guides/customization/navigation',
  '/docs/es/guides/customization/navigation',
]

for (const path of PAGES) {
  test(`OnThisPage lists no duplicate headings on ${path}`, async ({
    page,
  }) => {
    // xl viewport so the right-rail TOC is visible
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    // The OnThisPage primitive is style-neutral and exposes `data-otp-root`
    // instead of baked-in `w-toc` classes, so the hook is the stable selector.
    await page.waitForSelector('nav[data-otp-root]')

    const toc = await page.$$eval('nav[data-otp-root] a[href^="#"]', (links) =>
      links.map((a) => (a.textContent ?? '').trim()),
    )
    expect(toc.length).toBeGreaterThan(0)

    const duplicates = toc.filter((t, i) => toc.indexOf(t) !== i)
    expect(duplicates).toEqual([])
  })
}
