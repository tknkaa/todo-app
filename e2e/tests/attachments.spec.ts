import { expect, test } from '@playwright/test'
import { addTask, openTask, signUp } from './helpers'

test('attaches a file, downloads it and removes it', async ({ page }) => {
  await signUp(page)
  await addTask(page, '添付')
  await openTask(page, '添付')

  await page.locator('input[type=file]').setInputFiles({
    name: 'memo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('こんにちは'),
  })
  const file = page.getByRole('link', { name: 'memo.txt' })
  await expect(file).toBeVisible()

  const href = (await file.getAttribute('href'))!
  const response = await page.request.get(href)
  expect(response.ok()).toBe(true)
  expect(await response.text()).toBe('こんにちは')
  expect(response.headers()['content-disposition']).toContain('attachment')

  await page.getByRole('button', { name: 'memo.txtを削除' }).click()
  await expect(file).toHaveCount(0)
  expect((await page.request.get(href)).status()).toBe(404)
})

test('refuses a file that is too large', async ({ page }) => {
  await signUp(page)
  await addTask(page, '大きい')
  await openTask(page, '大きい')

  await page.locator('input[type=file]').setInputFiles({
    name: 'big.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert')).toContainText('5 MB')
  await expect(page.getByRole('link', { name: 'big.bin' })).toHaveCount(0)
})
