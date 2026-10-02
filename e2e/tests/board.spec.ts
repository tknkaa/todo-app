import { expect, test } from '@playwright/test'
import { addTask, card, cardById, column, signUp, titles } from './helpers'

// Smoke tests of the board. How cards are laid out and exactly where a drop lands are left out on
// purpose: they are still changing, and unit tests cover the ordering rules.
// The board starts below the header, and a drag needs both cards on screen at once, so use a tall
// window instead of scrolling in the middle of a drag.
test.use({ viewport: { width: 1280, height: 1200 } })

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

  test('drops a card before or after the card it is dropped on', async ({ page }) => {
    for (const title of ['C', 'B', 'A']) await addTask(page, title)
    await expect.poll(() => titles(page, 'todo')).toEqual(['A', 'B', 'C'])

    // C onto the upper half of A goes first; then onto the lower half of B goes last again.
    await card(page, 'C').dragTo(card(page, 'A'), { targetPosition: { x: 40, y: 6 } })
    await expect.poll(() => titles(page, 'todo')).toEqual(['C', 'A', 'B'])

    const height = (await card(page, 'B').boundingBox())!.height
    await card(page, 'C').dragTo(card(page, 'B'), { targetPosition: { x: 40, y: height - 6 } })
    await expect.poll(() => titles(page, 'todo')).toEqual(['A', 'B', 'C'])

    await page.reload()
    await expect.poll(() => titles(page, 'todo')).toEqual(['A', 'B', 'C'])
  })

  test('drops a card between two cards of another column', async ({ page }) => {
    for (const title of ['Y', 'Z']) {
      await addTask(page, title)
      await card(page, title).getByLabel(`${title}のステータス`).selectOption('doing')
    }
    await addTask(page, 'M')
    await expect.poll(() => titles(page, 'doing')).toEqual(['Y', 'Z'])

    await card(page, 'M').dragTo(card(page, 'Z'), { targetPosition: { x: 40, y: 6 } })
    await expect.poll(() => titles(page, 'doing')).toEqual(['Y', 'M', 'Z'])
    await expect.poll(() => titles(page, 'todo')).toEqual([])
  })

  test('leaves the card where it was when it is dropped on itself or nowhere', async ({ page }) => {
    for (const title of ['B', 'A']) await addTask(page, title)

    // Grab B by its padding (the middle of a card is a link, which would be a click, not a drag).
    await card(page, 'B').dragTo(card(page, 'B'), {
      sourcePosition: { x: 6, y: 6 },
      targetPosition: { x: 60, y: 8 },
    })
    await card(page, 'A').dragTo(page.getByRole('heading', { name: 'タスクを追加' }))
    await expect.poll(() => titles(page, 'todo')).toEqual(['A', 'B'])
    await expect(card(page, 'A')).toBeVisible()
    await expect(card(page, 'B')).toBeVisible()
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
