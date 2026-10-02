import { expect, test } from '@playwright/test'
import { addTask, card, newEmail, openTask, signUp, titles } from './helpers'

test.describe('sharing a task', () => {
  test('shows it to the other person at once, and changes both ways appear live', async ({
    browser,
  }) => {
    const alice = await (await browser.newContext()).newPage()
    const bob = await (await browser.newContext()).newPage()
    const bobEmail = await signUp(bob)
    await signUp(alice)
    await addTask(alice, '共有する')

    await openTask(alice, '共有する')
    await alice.getByPlaceholder('共有する相手のメールアドレス').fill(bobEmail)
    await alice.getByRole('button', { name: '共有する', exact: true }).click()
    await expect(alice.getByText(bobEmail)).toBeVisible()

    // Bob had the board open already: the task shows up without a reload.
    await expect(card(bob, '共有する')).toBeVisible({ timeout: 15_000 })
    await expect(card(bob, '共有する')).toContainText('共有されたタスク')

    // Bob moves it, and Alice sees the move on her board.
    await card(bob, '共有する').getByLabel('共有するのステータス').selectOption('doing')
    await alice.getByRole('link', { name: 'ボードに戻る' }).click()
    await expect.poll(() => titles(alice, 'doing'), { timeout: 15_000 }).toEqual(['共有する'])

    // Bob cannot delete it, Alice can stop sharing, and then it leaves Bob's board.
    await expect(card(bob, '共有する').getByRole('button', { name: '共有するを削除' })).toHaveCount(
      0,
    )
    await openTask(alice, '共有する')
    await alice.getByRole('button', { name: `${bobEmail}との共有を解除` }).click()
    await expect(card(bob, '共有する')).toHaveCount(0, { timeout: 15_000 })

    await alice.context().close()
    await bob.context().close()
  })

  test('shares with someone who signs up afterwards, without telling whether they had an account', async ({
    browser,
  }) => {
    const alice = await (await browser.newContext()).newPage()
    await signUp(alice)
    await addTask(alice, '招待する')
    await openTask(alice, '招待する')

    const newcomer = newEmail('newcomer')
    await alice.getByPlaceholder('共有する相手のメールアドレス').fill(newcomer)
    await alice.getByRole('button', { name: '共有する', exact: true }).click()
    await expect(alice.getByText(newcomer)).toBeVisible()
    // The same address again is not listed twice.
    await alice.getByPlaceholder('共有する相手のメールアドレス').fill(newcomer)
    await alice.getByRole('button', { name: '共有する', exact: true }).click()
    await expect(alice.getByText(newcomer)).toHaveCount(1)

    const page = await (await browser.newContext()).newPage()
    await signUp(page, newcomer)
    await expect(card(page, '招待する')).toBeVisible()

    await alice.context().close()
    await page.context().close()
  })
})
