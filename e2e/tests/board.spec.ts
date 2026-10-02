import { expect, test } from '@playwright/test'
import { addTask, card, cardById, column, signUp, titles } from './helpers'

// Smoke tests of the board. How cards are laid out and exactly where a drop lands are left out on
// purpose: they are still changing, and unit tests cover the ordering rules.
test.describe('the board', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page)
  })

  test('adds a task, puts the newest first and keeps them after a reload', async ({ page }) => {
    await addTask(page, '一つ目')
    await addTask(page, '二つ目', { due: '2031-03-04T09:00', reminder: true })
    await expect(card(page, '二つ目')).toContainText('リマインド: 1日前')
    await expect.poll(() => titles(page, 'todo')).toEqual(['二つ目', '一つ目'])

    await page.reload()
    await expect.poll(() => titles(page, 'todo')).toEqual(['二つ目', '一つ目'])
  })

  test('moves a task to another column with the status select', async ({ page }) => {
    await addTask(page, '移動する')
    await card(page, '移動する').getByLabel('移動するのステータス').selectOption('doing')
    await expect.poll(() => titles(page, 'doing')).toEqual(['移動する'])

    await page.reload()
    await expect.poll(() => titles(page, 'doing')).toEqual(['移動する'])
    await expect.poll(() => titles(page, 'todo')).toEqual([])
  })

  test('moves a task to another column by dragging it', async ({ page }) => {
    await addTask(page, 'ドラッグ')
    await card(page, 'ドラッグ').dragTo(column(page, 'doing'))
    await expect.poll(() => titles(page, 'doing')).toEqual(['ドラッグ'])

    await page.reload()
    await expect.poll(() => titles(page, 'doing')).toEqual(['ドラッグ'])
  })

  test('edits and deletes a task', async ({ page }) => {
    await addTask(page, '直す前')
    const id = (await card(page, '直す前').getAttribute('data-task-id'))!
    await card(page, '直す前').getByRole('button', { name: '直す前を編集' }).click()
    await cardById(page, id).getByLabel('タスク名').fill('直した後')
    await cardById(page, id).getByRole('button', { name: '保存' }).click()
    await expect(card(page, '直した後')).toBeVisible()

    await card(page, '直した後').getByRole('button', { name: '直した後を削除' }).click()
    await expect(card(page, '直した後')).toHaveCount(0)
    await page.reload()
    await expect.poll(() => titles(page, 'todo')).toEqual([])
  })
})
