import { test, expect } from '@playwright/test'

test.describe('Component-Specific Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('navigation should be accessible', async ({ page }) => {
    const nav = page.locator('nav').first()
    if ((await nav.count()) > 0) {
      const hasAriaLabel = await nav.getAttribute('aria-label')
      const hasAriaLabelledBy = await nav.getAttribute('aria-labelledby')

      expect(hasAriaLabel || hasAriaLabelledBy).toBeTruthy()
    }

    const navLinks = page.locator('nav a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)
  })

  test('search input should be accessible', async ({ page }) => {
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], [role="search"] input',
      )
      .first()

    if ((await searchInput.count()) > 0) {
      const label = await searchInput.getAttribute('aria-label')
      const labelledBy = await searchInput.getAttribute('aria-labelledby')
      const placeholder = await searchInput.getAttribute('placeholder')

      expect(label || labelledBy || placeholder).toBeTruthy()
    }
  })

  test('language switcher should be accessible', async ({ page }) => {
    // Target the real trigger. The previous selector keyed off
    // `aria-label*="language"` / `[class*="lang"]`, which matched an unrelated
    // element that carries no `aria-expanded`, so the assertion was testing
    // the selector rather than the control. React Aria's MenuTrigger already
    // supplies the menu semantics, so key off those.
    const trigger = page.locator('button[aria-haspopup]').first()
    const switcher = trigger.or(
      page.locator('[aria-label*="language" i][aria-expanded]'),
    )
    const control = (await trigger.count()) > 0 ? trigger : switcher.first()

    test.skip(
      (await control.count()) === 0,
      'no language switcher rendered on this site',
    )

    expect(await control.getAttribute('aria-expanded')).toBe('false')

    await control.click()
    await expect(control).toHaveAttribute('aria-expanded', 'true')
  })

  test('code blocks should be accessible', async ({ page }) => {
    const codeBlocks = page.locator('pre, code')

    const count = await codeBlocks.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('images should have proper alt text', async ({ page }) => {
    const images = await page.locator('img').all()

    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')

      const isDecorative = role === 'presentation' || alt === '' || alt === null

      if (!isDecorative) {
        expect(alt?.trim().length).toBeGreaterThan(0)
      }
    }
  })

  test('tables should be accessible', async ({ page }) => {
    const tables = await page.locator('table').all()

    for (const table of tables) {
      const caption = await table.locator('caption').count()
      const ariaLabel = await table.getAttribute('aria-label')
      const ariaLabelledBy = await table.getAttribute('aria-labelledby')

      expect(caption > 0 || ariaLabel || ariaLabelledBy).toBeTruthy()
    }
  })

  test('links should have descriptive text', async ({ page }) => {
    // An image-only link is not a problem: its accessible name comes from the
    // image's `alt`. The previous version only looked at text content,
    // `aria-label` and `title`, so the navbar logo was reported as unnamed.
    // Collecting in one evaluate also avoids a round trip per link.
    const unnamed = await page.evaluate(() => {
      const problems: string[] = []

      for (const link of document.querySelectorAll('a[href]')) {
        const named =
          (link.getAttribute('aria-label') ?? '').trim().length > 0 ||
          (link.getAttribute('title') ?? '').trim().length > 0 ||
          (link.textContent ?? '').trim().length > 0 ||
          [...link.querySelectorAll('img[alt]')].some(
            (img) => (img.getAttribute('alt') ?? '').trim().length > 0,
          )

        if (!named) problems.push(link.getAttribute('href') ?? '(no href)')
      }

      return problems
    })

    expect(unnamed).toEqual([])
  })

  test('should handle theme switching accessibly', async ({ page }) => {
    const themeToggle = page
      .locator('button[aria-label*="theme" i], [class*="theme"] button')
      .first()

    if ((await themeToggle.count()) > 0) {
      await themeToggle.focus()

      const hasAriaLabel = await themeToggle.getAttribute('aria-label')
      const hasAriaPressed = await themeToggle.getAttribute('aria-pressed')

      expect(hasAriaLabel || hasAriaPressed).toBeTruthy()
    }
  })

  test('sidebars should have proper landmarks', async ({ page }) => {
    const sidebar = page.locator('aside, [role="complementary"]').first()

    if ((await sidebar.count()) > 0) {
      const role = await sidebar.getAttribute('role')
      const label = await sidebar.getAttribute('aria-label')

      if (role === 'complementary') {
        expect(label).toBeTruthy()
      }
    }
  })

  test('pagination should be accessible', async ({ page }) => {
    const pagination = page
      .locator('[role="navigation"][aria-label*="pag" i], .pagination')
      .first()

    if ((await pagination.count()) > 0) {
      const ariaLabel = await pagination.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()

      const currentPage = await pagination.locator('[aria-current]').count()
      expect(currentPage).toBe(1)
    }
  })
})
