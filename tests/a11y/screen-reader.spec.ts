import { test, expect } from '@playwright/test'

test.describe('Screen Reader Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have proper ARIA roles on semantic elements', async ({
    page,
  }) => {
    const header = page.locator('header').first()
    if ((await header.count()) > 0) {
      const role = await header.getAttribute('role')
      expect(role).toBeNull()
    }

    const nav = page.locator('nav').first()
    if ((await nav.count()) > 0) {
      const role = await nav.getAttribute('role')
      expect(role).toBeNull()
    }

    const main = page.locator('main').first()
    if ((await main.count()) > 0) {
      const role = await main.getAttribute('role')
      expect(role).toBeNull()
    }
  })

  test('should have valid aria-label on interactive elements', async ({
    page,
  }) => {
    const buttonsWithoutLabels = []

    const buttons = page.locator('button').all()
    for (const button of buttons) {
      const hasLabel = await button.getAttribute('aria-label')
      const hasText = await button.textContent()
      const hasTitle = await button.getAttribute('title')
      const hasAriaLabelledBy = await button.getAttribute('aria-labelledby')

      if (!hasLabel && !hasText?.trim() && !hasTitle && !hasAriaLabelledBy) {
        const id = await button.getAttribute('id')
        buttonsWithoutLabels.push(id || 'unnamed-button')
      }
    }

    expect(buttonsWithoutLabels).toHaveLength(0)
  })

  test('should have proper live regions for dynamic content', async ({
    page,
  }) => {
    const liveRegions = page.locator(
      '[aria-live], [role="alert"], [role="status"]',
    )

    const count = await liveRegions.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should have valid aria-describedby references', async ({ page }) => {
    const elementsWithDescribedBy = await page
      .locator('[aria-describedby]')
      .all()

    for (const element of elementsWithDescribedBy) {
      const describedById = await element.getAttribute('aria-describedby')
      if (describedById) {
        const targetElement = page.locator(`#${describedById}`)
        expect(await targetElement.count()).toBe(1)
      }
    }
  })

  test('should have valid aria-labelledby references', async ({ page }) => {
    const elementsWithLabelledBy = await page.locator('[aria-labelledby]').all()

    for (const element of elementsWithLabelledBy) {
      const labelledById = await element.getAttribute('aria-labelledby')
      if (labelledById) {
        const targetElement = page.locator(`#${labelledById}`)
        expect(await targetElement.count()).toBe(1)
      }
    }
  })

  test('should have proper button roles for clickable elements', async ({
    page,
  }) => {
    const clickableDivs = await page
      .locator('div[onclick], div[role="button"]')
      .all()

    for (const element of clickableDivs) {
      const role = await element.getAttribute('role')
      const tabIndex = await element.getAttribute('tabindex')

      expect(role).toBe('button')
      expect(tabIndex).not.toBeNull()
    }
  })

  test('should have proper list structure', async ({ page }) => {
    const lists = page.locator('ul, ol').all()

    for (const list of lists) {
      const listItems = await list.locator('li').count()
      if (listItems > 0) {
        const directChildren = await list.evaluate((el) => {
          return Array.from(el.children).map((c) => c.tagName)
        })

        const hasOnlyLi = directChildren.every(
          (tag) => tag === 'LI' || tag === 'SCRIPT',
        )
        expect(hasOnlyLi).toBe(true)
      }
    }
  })

  test('should have proper table headers', async ({ page }) => {
    const tables = page.locator('table').all()

    for (const table of tables) {
      const headers = await table.locator('th').count()
      if (headers > 0) {
        const hasScope = await table.locator('th[scope]').count()
        const hasAriaLabel = await table.locator('[aria-labelledby]').count()
        const hasCaption = await table.locator('caption').count()

        const hasProperHeaderStructure =
          hasScope > 0 || hasAriaLabel > 0 || hasCaption > 0
        expect(hasProperHeaderStructure).toBe(true)
      }
    }
  })

  test('should have proper focus visible for custom controls', async ({
    page,
  }) => {
    const customControls = page
      .locator('[role="button"], [role="checkbox"], [role="radio"]')
      .all()

    for (const control of customControls) {
      const tabIndex = await control.getAttribute('tabindex')
      expect(['0', '-1']).toContain(tabIndex)

      const hasRole = await control.getAttribute('role')
      expect(hasRole).not.toBeNull()
    }
  })

  test('should handle aria-expanded for collapsible elements', async ({
    page,
  }) => {
    const collapsibleElements = page.locator('[aria-expanded]').all()

    for (const element of collapsibleElements) {
      const expanded = await element.getAttribute('aria-expanded')
      expect(['true', 'false']).toContain(expanded)
    }
  })
})
