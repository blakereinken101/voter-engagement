import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('sign-in page loads', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page).toHaveTitle(/Threshold|Sign/)
    // The sign-in form should be visible
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('sign-up page loads', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  })

  test('unauthenticated dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/sign-in/)
    expect(page.url()).toContain('sign-in')
  })
})
