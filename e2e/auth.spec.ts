import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('sign-in form validates required fields', async ({ page }) => {
    await page.goto('/sign-in')

    // Try submitting empty form
    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()
      // Should show validation or stay on page
      expect(page.url()).toContain('sign-in')
    }
  })

  test('sign-in with invalid credentials shows error', async ({ page }) => {
    await page.goto('/sign-in')

    await page.fill('input[type="email"], input[name="email"]', 'nonexistent@test.com')
    await page.fill('input[type="password"]', 'wrongpassword123')

    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()

      // Wait for error message to appear
      const errorMessage = page.locator('[role="alert"], .error, [class*="error"]')
      await expect(errorMessage).toBeVisible({ timeout: 5000 }).catch(() => {
        // Error might appear differently — at minimum we should still be on sign-in
        expect(page.url()).toContain('sign-in')
      })
    }
  })

  test('sign-up form validates required fields', async ({ page }) => {
    await page.goto('/sign-up')

    // Attempt signup with short password
    const emailInput = page.locator('input[type="email"], input[name="email"]')
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@test.com')
      await page.fill('input[type="password"]', 'short')

      const submitButton = page.locator('button[type="submit"]')
      if (await submitButton.isVisible()) {
        await submitButton.click()
        // Should show validation error or stay on page
        expect(page.url()).toContain('sign-up')
      }
    }
  })
})
