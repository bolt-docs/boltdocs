import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * E2E coverage for fast refresh on layout edits.
 *
 * `layout.tsx` is the user-supplied documentation wrapper. It is consumed
 * through the `virtual:boltdocs-layout` module, so an edit is an ordinary
 * module update and must not reload the document. External pages under
 * `pages-external/` are plain React modules reached through the user entry and
 * must behave the same way.
 *
 * Both used to answer with a full reload, which discarded the scroll position
 * and re-ran every loader for a one-line change.
 */

const BASE = 'http://localhost:5195'
const DOCS_DIR = path.resolve(__dirname, '../../docs/docs')
const EXTERNAL_DIR = path.resolve(DOCS_DIR, 'pages-external')
const LAYOUT_FILE = path.join(DOCS_DIR, 'layout.tsx')
// Must live at the root of pages-external: the file router skips directories
// starting with `_`, so a file under `_sections/` never becomes a route. The
// file name is the URL, with no extension.
const EXTERNAL_ROUTE_NAME = 'e2e-hmr-probe'
const EXTERNAL_SECTION = path.join(EXTERNAL_DIR, `${EXTERNAL_ROUTE_NAME}.tsx`)
const EXTERNAL_URL = `/${EXTERNAL_ROUTE_NAME}`

const PROBE_PAGE = path.join(DOCS_DIR, 'e2e-layout-probe.mdx')
const PROBE_URL = '/docs/e2e-layout-probe'

const PROBE_MARKDOWN = `---
title: E2E Layout Probe
description: Fixture temporal para verificar fast refresh de layout.
---

Probe body.
`

const EXTERNAL_MODULE = `export default function E2eHmrProbePage() {
  return <p>E2E-LAYOUT-PROBE-V1</p>
}
`

function countLoads(page: Page): () => number {
  let loads = 0
  page.on('load', () => {
    loads++
  })
  return () => loads
}

async function waitForSettledLoads(
  page: Page,
  snapshot: () => number,
  quietMs = 1500,
): Promise<void> {
  let last = snapshot()
  for (;;) {
    await page.waitForTimeout(quietMs)
    const now = snapshot()
    if (now === last) return
    last = now
  }
}

async function waitForUrl(
  request: Page['request'],
  url: string,
  timeoutMs = 45_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const res = await request.get(url)
    if (res.ok()) return
    if (Date.now() > deadline) {
      throw new Error(`${url} never became available`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

test.describe('Layout fast refresh', () => {
  test.describe.configure({ mode: 'serial' })

  let layoutOriginal: string

  test.beforeAll(async ({ request }) => {
    layoutOriginal = fs.readFileSync(LAYOUT_FILE, 'utf-8')

    fs.writeFileSync(PROBE_PAGE, PROBE_MARKDOWN, 'utf-8')
    fs.writeFileSync(EXTERNAL_SECTION, EXTERNAL_MODULE, 'utf-8')

    // Wait for both probes to be served. External pages live at the site root
    // and are not listed in the routes virtual module, so each URL is polled
    // directly rather than gating on module contents.
    await waitForUrl(request, `${BASE}/docs/e2e-layout-probe`)
    await waitForUrl(request, `${BASE}/e2e-hmr-probe`)
  })

  test.afterAll(() => {
    fs.writeFileSync(LAYOUT_FILE, layoutOriginal, 'utf-8')
    fs.rmSync(PROBE_PAGE, { force: true })
    fs.rmSync(EXTERNAL_SECTION, { force: true })
  })

  test('applying a layout change refreshes without reloading the document', async ({
    page,
  }) => {
    const loads = countLoads(page)
    await page.goto(PROBE_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Probe body.')).toBeVisible({
      timeout: 20_000,
    })

    // Track scroll so a reload is detectable even if the load event races.
    await page.evaluate(() => window.scrollTo(0, 240))
    await waitForSettledLoads(page, loads)
    const before = loads()

    const stamped = `${layoutOriginal}\n// e2e-layout-probe-${Date.now()}\n`
    fs.writeFileSync(LAYOUT_FILE, stamped, 'utf-8')

    // Wait for the module to actually be re-fetched, proving HMR ran, then
    // assert the document itself was never replaced.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('script[type="module"]')].length > 0 &&
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('boltdocs-layout')),
      undefined,
      { timeout: 20_000 },
    )
    await waitForSettledLoads(page, loads)

    expect(loads()).toBe(before)
  })

  test('editing an external page module refreshes without reloading', async ({
    page,
  }) => {
    const loads = countLoads(page)
    await page.goto(EXTERNAL_URL, { waitUntil: 'domcontentloaded' })

    // The probe is a real file route, so the new text only appears if the
    // module was served. Asserting on it keeps the load counter honest: a page
    // that never rendered would make the no-reload assertion vacuously true.
    await expect(page.getByText('E2E-LAYOUT-PROBE-V1')).toBeVisible({
      timeout: 30_000,
    })

    await waitForSettledLoads(page, loads)
    const before = loads()

    fs.writeFileSync(
      EXTERNAL_SECTION,
      EXTERNAL_MODULE.replace('V1', 'V2'),
      'utf-8',
    )

    // The updated text only appears if the module hot-swapped in place.
    await expect(page.getByText('E2E-LAYOUT-PROBE-V2')).toBeVisible({
      timeout: 30_000,
    })

    expect(loads()).toBe(before)
  })
})
