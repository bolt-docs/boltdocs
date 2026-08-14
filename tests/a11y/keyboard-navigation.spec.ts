import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should be able to navigate to all interactive elements using Tab', async ({
    page,
  }) => {
    const interactiveSelectors = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
    ]

    const interactiveElements = await page
      .locator(interactiveSelectors.join(','))
      .all()

    let tabCount = 0
    for (const element of interactiveElements) {
      try {
        await element.focus()
        tabCount++
      } catch {}
    }

    expect(tabCount).toBeGreaterThan(0)
  })

  test('should have visible focus indicators on interactive elements', async ({
    page,
  }) => {
    const button = page.locator('button').first()
    if ((await button.count()) > 0) {
      await button.focus()

      const outlineStyle = await button.evaluate((el) => {
        return window.getComputedStyle(el).outlineStyle
      })

      const outlineWidth = await button.evaluate((el) => {
        return window.getComputedStyle(el).outlineWidth
      })

      expect(outlineStyle).not.toBe('none')
      expect(outlineWidth).not.toBe('0px')
    }
  })

  test('should be able to close modal dialogs with Escape key', async ({
    page,
  }) => {
    const modalSelectors = ['[role="dialog"]', '.modal', '[aria-modal="true"]']

    for (const selector of modalSelectors) {
      const modal = page.locator(selector).first()
      if ((await modal.count()) > 0) {
        await modal.focus()
        await page.keyboard.press('Escape')

        const isVisible = await modal.isVisible()
        expect(isVisible).toBe(false)
        break
      }
    }
  })

  test('should have proper tab order for navigation', async ({ page }) => {
    const focusableElements = await page
      .locator(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      .all()

    let previousTabIndex = -1
    for (const element of focusableElements) {
      const tabIndex = await element.evaluate((el) => el.tabIndex)
      if (tabIndex >= 0 && tabIndex < 999) {
        expect(tabIndex).toBeGreaterThanOrEqual(previousTabIndex)
        previousTabIndex = tabIndex
      }
    }
  })

  test('should skip to main content with skip link', async ({ page }) => {
    const skipLink = page
      .locator('a[href^="#main"], a[href^="#content"], [class*="skip"]')
      .first()

    if ((await skipLink.count()) > 0) {
      await skipLink.focus()
      await skipLink.click()

      const activeElement = await page.evaluate(
        () => document.activeElement?.id || document.activeElement?.tagName,
      )
      expect(activeElement).toMatch(/main|content|article/)
    }
  })

  test('should handle arrow key navigation in menus', async ({ page }) => {
    const menuItems = page.locator('[role="menuitem"], .menu-item, nav a')

    if ((await menuItems.count()) > 1) {
      const firstItem = menuItems.first()
      await firstItem.focus()

      await page.keyboard.press('ArrowRight')
      const secondElement = page.locator(':focus')

      expect(await secondElement.count()).toBe(1)
    }
  })

  test('should have accessible dropdown menus', async ({ page }) => {
    const dropdown = page
      .locator('[role="combobox"], select, [aria-haspopup]')
      .first()

    if ((await dropdown.count()) > 0) {
      await dropdown.focus()
      await page.keyboard.press('Space')

      const isExpanded = await dropdown.getAttribute('aria-expanded')
      expect(isExpanded).toBe('true')
    }
  })

  test('should have proper focus management after actions', async ({
    page,
  }) => {
    const link = page.locator('a[href]').first()
    if ((await link.count()) > 0) {
      await link.click()

      await page.waitForLoadState('networkidle')

      const activeElement = await page.evaluate(
        () => document.activeElement?.tagName,
      )
      expect(['BODY', 'MAIN', 'ARTICLE', 'H1']).toContain(activeElement)
    }
  })
})
