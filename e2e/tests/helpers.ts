import { randomUUID } from 'node:crypto'
import { expect, type Locator, type Page } from '@playwright/test'

export const PASSWORD = 'password-for-e2e-1234'

/** An address nobody else in the run uses, so tests never depend on each other's accounts. */
export function newEmail(prefix = 'user') {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`
}

/** Creates an account through the login page and waits for the board. */
export async function signUp(page: Page, email = newEmail()) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'アカウントを作成する' }).click()
  await page.getByPlaceholder('メールアドレス').fill(email)
  await page.getByPlaceholder('パスワード（8文字以上）').fill(PASSWORD)
  await page.getByRole('button', { name: '登録する' }).click()
  await expect(page.getByRole('heading', { name: 'タスクを追加' })).toBeVisible()
  return email
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByPlaceholder('メールアドレス').fill(email)
  await page.getByPlaceholder('パスワード（8文字以上）').fill(password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
}

/** Adds a task from the form on the board. */
export async function addTask(
  page: Page,
  title: string,
  options: { due?: string; reminder?: boolean } = {},
) {
  await page.getByPlaceholder('次にやることは？').fill(title)
  if (options.due) await page.getByLabel('締め切り').first().fill(options.due)
  if (options.reminder) await page.getByLabel('メールでリマインドする').check()
  await page.getByRole('button', { name: '追加する' }).click()
  await expect(card(page, title)).toBeVisible()
}

export const column = (page: Page, status: 'todo' | 'doing' | 'done') =>
  page.locator(`section[aria-labelledby="column-${status}"]`)

export const card = (page: Page, title: string): Locator =>
  page.locator('li[data-task-id]', { hasText: title })

/** A card found by its id, which still works while its title is an input (editing). */
export const cardById = (page: Page, id: string): Locator =>
  page.locator(`li[data-task-id="${id}"]`)

/** Titles of the cards in a column, top to bottom. */
export async function titles(page: Page, status: 'todo' | 'doing' | 'done') {
  // The title is the link without an aria-label; the "open" link next to it has one.
  return column(page, status).locator('li[data-task-id] a:not([aria-label])').allTextContents()
}

/** Opens the full-screen page of a task from its card. */
export async function openTask(page: Page, title: string) {
  await page.getByRole('link', { name: `${title}を全画面で開く` }).click()
  await expect(page.getByLabel('タスク名')).toHaveValue(title)
}
