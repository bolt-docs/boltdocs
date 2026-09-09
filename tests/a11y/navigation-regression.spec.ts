import { expect, test } from '@playwright/test'

test.describe('Boltdocs navigation and runtime assets', () => {
  test('navigates to the destination without duplicate history updates', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    let observeNavigationConsole = false
    await page.addInitScript(() => {
      const originalPushState = history.pushState.bind(history)
      const state = window as Window & {
        __pushes?: number
        __routeCommits?: Array<{ pathname?: string }>
      }
      state.__pushes = 0
      state.__routeCommits = []
      history.pushState = (...args) => {
        state.__pushes = (state.__pushes || 0) + 1
        return originalPushState(...args)
      }
      window.addEventListener('boltdocs:route-commit', (event) => {
        state.__routeCommits?.push(
          (event as CustomEvent<{ pathname?: string }>).detail,
        )
      })
    })
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    page.on('console', (message) => {
      if (observeNavigationConsole && message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await page.goto('/docs/guides', { waitUntil: 'domcontentloaded' })
    const link = page
      .locator('a[href="/docs/guides/getting-started/cli"]')
      .first()
    await expect(link).toHaveAttribute('href', /\/docs\//, { timeout: 10000 })
    const destination = await link.getAttribute('href')
    if (!destination) throw new Error('Expected an internal docs link')

    const expectedPath = new URL(destination, page.url()).pathname
    const initialHeading = await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => null)
    observeNavigationConsole = true
    await link.click()
    await expect
      .poll(() => page.url(), { timeout: 5000 })
      .toContain(destination)
    await expect
      .poll(
        () =>
          page.evaluate(
            (path) =>
              (
                window as Window & {
                  __routeCommits?: Array<{ pathname?: string }>
                }
              ).__routeCommits?.some((commit) => commit.pathname === path) ??
              false,
            expectedPath,
          ),
        { timeout: 5000 },
      )
      .toBe(true)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 })
    await expect
      .poll(() => page.locator('h1').first().textContent(), { timeout: 5000 })
      .not.toBe(initialHeading)

    expect(
      await page.evaluate(
        () => (window as Window & { __pushes?: number }).__pushes,
      ),
    ).toBe(1)
    expect(pageErrors).toEqual([])
    expect(
      consoleErrors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes(
            'Failed to load resource: the server responded with a status of 403',
          ) &&
          !error.includes('Encountered two children with the same key') &&
          !error.includes('In HTML, whitespace text nodes cannot be a child') &&
          !error.includes('Invalid DOM property'),
      ),
    ).toEqual([])
  })

  test('keeps every configured tab available at a localized docs root', async ({
    page,
    request,
  }) => {
    await page.goto('/docs/es', { waitUntil: 'domcontentloaded' })

    const tabs = page.locator('div.scrollbar-hide a')
    await expect(tabs).toHaveCount(5)
    await expect(tabs.first()).toHaveText('Guías')

    const hrefs = await tabs.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    )
    expect(hrefs.every((href) => href?.startsWith('/docs/es/'))).toBe(true)
    expect(hrefs.every((href) => href && !href.includes('#'))).toBe(true)

    const responses = await Promise.all(
      hrefs.map((href) => request.get(href || '/docs/es')),
    )
    expect(responses.every((response) => response.ok())).toBe(true)
  })

  test('navigates from docs to an external page without a document reload', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const originalPushState = history.pushState.bind(history)
      const state = window as Window & { __pushes?: number }
      state.__pushes = 0
      history.pushState = (...args) => {
        state.__pushes = (state.__pushes || 0) + 1
        return originalPushState(...args)
      }
    })

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await page.locator('a[href="/showcase"]').first().click()
    await expect(page).toHaveURL(/\/showcase$/)
    await expect(page.locator('.boltdocs-external-content')).toBeVisible()
    expect(
      await page.evaluate(
        () => (window as Window & { __pushes?: number }).__pushes,
      ),
    ).toBe(1)
  })

  test('serves public assets and emits the localized html language', async ({
    page,
    request,
  }) => {
    const asset = await request.get('/docs/dark.svg')
    expect(asset.ok()).toBeTruthy()
    expect(asset.headers()['content-type']).toContain('image/svg+xml')

    await page.goto('/docs/es', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })
})
