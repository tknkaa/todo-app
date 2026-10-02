import { expect, test } from '@playwright/test'
import { signIn, signUp } from './helpers'

// Smoke tests: the flows that must keep working however the screens are redesigned.
test.describe('signing in', () => {
  test('sends visitors who are not signed in to the login page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'タスクを追加' })).toHaveCount(0)

    await page.goto('/tasks/anything')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('creates an account, signs out and signs in again', async ({ page }) => {
    const email = await signUp(page)
    await expect(page.getByText(email)).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'タスクを追加' })).toBeVisible()

    await page.getByRole('button', { name: 'ログアウト' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await signIn(page, email)
    await expect(page.getByRole('heading', { name: 'タスクを追加' })).toBeVisible()
  })

  test('rejects a wrong password', async ({ page }) => {
    const email = await signUp(page)
    await page.getByRole('button', { name: 'ログアウト' }).click()

    await signIn(page, email, 'a-wrong-password-1')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('shows the GitHub button only when the server has keys for it', async ({ page }) => {
    // The test server is started without GitHub keys.
    await page.goto('/login')
    expect(await (await page.request.get('/api/config')).json()).toEqual({ github: false })
    await expect(page.getByRole('button', { name: /GitHub/ })).toHaveCount(0)
  })
})
