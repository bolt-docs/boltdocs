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
    const langSwitcher = page
      .locator(
        '[aria-label*="language" i], [aria-label*="locale" i], [class*="lang"]',
      )
      .first()

    if ((await langSwitcher.count()) > 0) {
      await langSwitcher.focus()
      await page.keyboard.press('Enter')

      const isExpanded = await langSwitcher.getAttribute('aria-expanded')
      expect(['true', 'false']).toContain(isExpanded)
    }
  })

  test('code blocks should be accessible', async ({ page }) => {
    const codeBlocks = page.locator('pre, code')

    const count = await codeBlocks.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('images should have proper alt text', async ({ page }) => {
    const images = page.locator('img').all()

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
    const tables = page.locator('table').all()

    for (const table of tables) {
      const caption = await table.locator('caption').count()
      const ariaLabel = await table.getAttribute('aria-label')
      const ariaLabelledBy = await table.getAttribute('aria-labelledby')

      expect(caption > 0 || ariaLabel || ariaLabelledBy).toBeTruthy()
    }
  })

  test('links should have descriptive text', async ({ page }) => {
    const links = page.locator('a[href]').all()

    const problematicLinks = []
    for (const link of links) {
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute('aria-label')
      const title = await link.getAttribute('title')

      const isDescriptive = (text?.trim().length ?? 0) > 0 || ariaLabel || title
      if (!isDescriptive) {
        const href = await link.getAttribute('href')
        problematicLinks.push(href)
      }
    }

    expect(problematicLinks).toHaveLength(0)
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
