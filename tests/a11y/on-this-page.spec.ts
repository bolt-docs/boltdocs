import { test, expect } from '@playwright/test'

// Pages that previously shipped duplicate headings (e.g. `### Search` twice on
// the integrations index). The "On this page" TOC must list each heading once.
const PAGES = [
  '/docs/integrations',
  '/docs/integrations/seo',
  '/docs/plugins/plugin-math',
  '/docs/plugins/plugin-rss',
  '/docs/plugins/plugin-llms-text',
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
    await page.waitForSelector('nav.w-toc')

    const toc = await page.$$eval('nav.w-toc a[href^="#"]', (links) =>
      links.map((a) => (a.textContent ?? '').trim()),
    )
    expect(toc.length).toBeGreaterThan(0)

    const duplicates = toc.filter((t, i) => toc.indexOf(t) !== i)
    expect(duplicates).toEqual([])
  })
}
