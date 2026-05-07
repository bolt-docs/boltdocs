import { test, expect } from '@playwright/test'

test.describe('i18n functionality', () => {
  test('renders english docs page content', async ({ page }) => {
    await page.goto('/docs/getting-started')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Getting Started' }),
    ).toBeVisible()
    await expect(page.getByText('This is the base for your new')).toBeVisible()
    await expect(page).toHaveURL(/\/docs\/getting-started\/?$/)
  })

  test('renders spanish docs page content', async ({ page }) => {
    await page.goto('/docs/getting-started')
    await page.getByRole('button', { name: /en/i }).click()
    await page.getByRole('menuitem', { name: /^es\b/i }).click()

    await expect(page).toHaveURL(/\/es\/getting-started\/?$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Empezando' }),
    ).toBeVisible()
    await expect(
      page.getByText('Esta es la base para tu nuevo proyecto'),
    ).toBeVisible()
  })

  test('switches locale using language menu', async ({ page }) => {
    await page.goto('/docs/getting-started')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Getting Started' }),
    ).toBeVisible()

    const switcher = page.getByRole('button', { name: /en/i })
    await switcher.click()
    await page.getByRole('menuitem', { name: /^es\b/i }).click()

    await expect(page).toHaveURL(/\/es\/getting-started\/?$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Empezando' }),
    ).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/\/es\/getting-started\/?$/)
  })
})
