import { expect, test } from '@playwright/test'
import { addTask, openTask, signUp } from './helpers'

test.describe('the task page', () => {
  test('edits a task and keeps the changes after a reload', async ({ page }) => {
    await signUp(page)
    await addTask(page, '詳細')
    await openTask(page, '詳細')
    await expect(page).toHaveURL(/\/tasks\/[\w-]+$/)

    await page.getByLabel('タスク名').fill('詳細(直した)')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.reload()
    await expect(page.getByLabel('タスク名')).toHaveValue('詳細(直した)')

    await page.getByRole('link', { name: 'ボードに戻る' }).click()
    await expect(page.getByRole('link', { name: '詳細(直した)', exact: true })).toBeVisible()
  })

  test('shows a message for a task that does not exist', async ({ page }) => {
    await signUp(page)
    await page.goto('/tasks/does-not-exist')
    await expect(page.getByText('タスクが見つかりません')).toBeVisible()
  })

  test('saves the body text and keeps it after a reload', async ({ page }) => {
    await signUp(page)
    await addTask(page, '本文')
    await openTask(page, '本文')

    await page.getByRole('textbox', { name: '本文', exact: true }).click()
    await page.keyboard.type('## 手順')
    await page.keyboard.press('Enter')
    await page.keyboard.type('[ ] 買う')
    await expect(page.getByText('保存していない変更があります')).toBeVisible()

    await page.getByRole('button', { name: '本文を保存' }).click()
    await expect(page.getByText('保存済み')).toBeVisible()

    await page.reload()
    const editor = page.getByRole('textbox', { name: '本文', exact: true })
    await expect(editor.getByRole('heading', { name: '手順' })).toBeVisible()
    await expect(editor).toContainText('買う')
  })

  test('warns instead of overwriting when someone else saved the body first', async ({ page }) => {
    await signUp(page)
    await addTask(page, '競合')
    await openTask(page, '競合')
    const id = page.url().split('/').pop()!

    await page.getByRole('textbox', { name: '本文', exact: true }).click()
    await page.keyboard.type('自分の編集')

    // Someone else saves the body from the version this page started with.
    const other = await page.request.patch(`/api/tasks/${id}`, {
      data: { description: '先に保存された本文', descriptionVersion: 0 },
    })
    expect(other.ok()).toBe(true)

    await expect(
      page.getByRole('alert').filter({ hasText: '他の人が先に本文を変更しました' }),
    ).toBeVisible()
    // The unsaved text is still there, and loading the latest replaces it on purpose.
    await expect(page.getByRole('textbox', { name: '本文', exact: true })).toContainText(
      '自分の編集',
    )
    await page.getByRole('button', { name: /最新を読み込む/ }).click()
    await expect(page.getByRole('textbox', { name: '本文', exact: true })).toContainText(
      '先に保存された本文',
    )
  })
})
