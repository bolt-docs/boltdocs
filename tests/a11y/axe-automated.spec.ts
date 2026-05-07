import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Automated Tests (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have no critical accessibility violations on homepage', async ({
    page,
  }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )

    expect(criticalViolations).toHaveLength(0)
  })

  test('should have valid page structure with landmarks', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

    const missingRoles = accessibilityScanResults.violations.filter(
      (v) => v.id === 'region',
    )

    expect(missingRoles).toHaveLength(0)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

    const headingIssues = accessibilityScanResults.violations.filter(
      (v) => v.id === 'heading-order',
    )

    expect(headingIssues).toHaveLength(0)
  })

  test('should have valid image alt text', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

    const imageAlts = accessibilityScanResults.violations.filter(
      (v) => v.id === 'image-alt' || v.id === 'input-image-alt',
    )

    expect(imageAlts).toHaveLength(0)
  })

  test('should have proper form label associations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

    const labelIssues = accessibilityScanResults.violations.filter(
      (v) => v.id === 'label' || v.id === 'form-field-multiple-labels',
    )

    expect(labelIssues).toHaveLength(0)
  })

  test('should have valid link names', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

    const linkNames = accessibilityScanResults.violations.filter(
      (v) => v.id === 'link-name',
    )

    expect(linkNames).toHaveLength(0)
  })

  test('should have valid color contrast', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze()

    const contrastIssues = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast',
    )

    expect(contrastIssues).toHaveLength(0)
  })

  test('should have no duplicate IDs', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

    const duplicateIds = accessibilityScanResults.violations.filter(
      (v) => v.id === 'duplicate-id',
    )

    expect(duplicateIds).toHaveLength(0)
  })
})
