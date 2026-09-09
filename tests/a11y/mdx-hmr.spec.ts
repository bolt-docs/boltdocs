import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * E2E coverage for the MDX hot-reload pipeline: a developer edits a `.mdx`
 * file in the docs project and the running page updates without a manual
 * refresh.
 *
 * The dev server (configured in playwright.config.ts) serves the `docs`
 * workspace project, so the fixture file is written into `docs/docs/` — the
 * project's docsDir — and cleaned up afterwards.
 */

const PLAYWRIGHT_BASE_URL = 'http://localhost:5195'
const FIXTURE_DIR = path.resolve(__dirname, '../../docs/docs')
const FIXTURE_FILE = path.join(FIXTURE_DIR, 'e2e-hmr-test.mdx')
const FIXTURE_URL = '/docs/e2e-hmr-test'

const BODY_V1 = `---
title: E2E HMR Test
description: Descripción fija del fixture E2E HMR. Este texto nunca cambia entre versiones.
---

# E2E HMR Body v1

Contenido de la primera versión. Marcador único: V1-CONTENT.
`

const BODY_V2 = `---
title: E2E HMR Test
description: Descripción fija del fixture E2E HMR. Este texto nunca cambia entre versiones.
---

# E2E HMR Body v2

Contenido de la segunda versión. Marcador único: V2-CONTENT.
`

const TITLE_V2 = `---
title: E2E HMR Title v2
description: Descripción fija del fixture E2E HMR. Este texto nunca cambia entre versiones.
---

# E2E HMR Body v2

Contenido de la segunda versión. Marcador único: V2-CONTENT.
`

/**
 * Counts top-level frame loads. A proper HMR update re-renders the module
 * in place; a full reload produces a new `load` event for the main frame.
 *
 * Attached at the start of each test so every navigation is counted, then
 * snapshot right before the edit: the assertion is that the edit causes zero
 * NEW loads. This absorbs the one-time full reload the dev server sends when
 * the fixture file is first added (beforeAll), which can otherwise land
 * between the route-regeneration wait and the edit.
 */
function trackLoads(page: Page): { snapshot: () => number } {
  let loads = 0
  page.on('load', () => {
    loads++
  })
  return { snapshot: () => loads }
}

/**
 * Waits until the fixture route shows up in the virtual routes module. The
 * dev server regenerates routes asynchronously after the fixture file is
 * written (file-add event); navigating before that lands on the 404 page and
 * hammering `page.goto` exhausts browser resources, so gate on the module
 * JSON instead (a lightweight fetch, no navigation).
 */
async function waitForFixtureRoute(
  request: Page['request'],
  fixturePath: string,
  timeoutMs = 30000,
): Promise<void> {
  // The dev server serves the whole app under /docs (playwright baseURL), so
  // the virtual module is reachable at /docs/@id/…. The JSON payload embeds
  // each route's path as a JSON string, so a substring check is exact.
  const url = `${PLAYWRIGHT_BASE_URL}/docs/@id/virtual:boltdocs-routes.ts`
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const res = await request.get(url)
    if (res.ok()) {
      const body = await res.text()
      if (body.includes(JSON.stringify(fixturePath))) return
    }
    if (Date.now() > deadline) {
      throw new Error(`fixture route ${fixturePath} never appeared in routes`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

/**
 * Waits until no new top-level load has fired for `quietMs`. The dev server
 * sends a full reload shortly after the fixture file is created (route
 * regeneration); waiting for the page to settle before snapshotting makes
 * the "zero new loads after the edit" assertion race-free.
 */
async function waitForStableLoads(
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

test.describe('MDX HMR', () => {
  // Both tests mutate the same fixture file, so they must never run in
  // parallel workers (fullyParallel is on globally in playwright.config).
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    fs.writeFileSync(FIXTURE_FILE, BODY_V1, 'utf-8')
  })

  test.afterAll(() => {
    fs.rmSync(FIXTURE_FILE, { force: true })
  })

  test('updates the rendered page when the MDX body changes', async ({
    page,
  }) => {
    const loads = trackLoads(page)

    // The dev server regenerates routes asynchronously after beforeAll writes
    // the fixture; wait for the route to exist, then navigate once.
    // Note: MDX headings render inside an anchor link whose `aria-label` and
    // svg <title> pollute the accessible name, so headings are asserted via
    // their text nodes (getByText) and the unique V1/V2-CONTENT markers.
    await waitForFixtureRoute(page.request, '/docs/e2e-hmr-test')
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('V1-CONTENT')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E HMR Body v1')).toBeVisible()

    // Let the one-time add-event reload (if any) land before snapshotting.
    await waitForStableLoads(page, loads.snapshot)
    const loadsBeforeEdit = loads.snapshot()

    // Body-only edit: same frontmatter, new content.
    fs.writeFileSync(FIXTURE_FILE, BODY_V2, 'utf-8')

    // The new content must appear without a page reload.
    await expect(page.getByText('E2E HMR Body v2')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('V2-CONTENT')).toBeVisible()
    await expect(page.getByText('V1-CONTENT')).toHaveCount(0)

    // Exactly zero new full reloads: the update went through the MDX module
    // graph (boltdocs:mdx-update), not a page reload.
    expect(loads.snapshot() - loadsBeforeEdit).toBe(0)
  })

  test('updates the page title when the MDX frontmatter changes', async ({
    page,
  }) => {
    const loads = trackLoads(page)
    fs.writeFileSync(FIXTURE_FILE, BODY_V2, 'utf-8')

    await waitForFixtureRoute(page.request, '/docs/e2e-hmr-test')
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('V2-CONTENT')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E HMR Body v2')).toBeVisible()

    // Let the add/regen reload (if any) settle, then snapshot the baseline.
    await waitForStableLoads(page, loads.snapshot)
    const loadsBeforeEdit = loads.snapshot()

    // Frontmatter change: the layout's own <h1> renders currentRoute.title
    // and is not wrapped in an anchor, so its accessible name is clean.
    fs.writeFileSync(FIXTURE_FILE, TITLE_V2, 'utf-8')

    await expect(
      page.getByRole('heading', { level: 1, name: 'E2E HMR Title v2' }),
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('V2-CONTENT')).toBeVisible()

    // Frontmatter delta HMR also skips the full reload.
    expect(loads.snapshot() - loadsBeforeEdit).toBe(0)
  })
})
