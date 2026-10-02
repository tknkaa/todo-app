import { expect, test } from '@playwright/test'
import { addTask, card, signUp, titles } from './helpers'

// A phone-sized screen: the board must not need sideways scrolling, and a card can be moved
// without dragging (touch screens cannot drag).
test('the board fits a phone and cards move with the status select', async ({ page }) => {
  await signUp(page)
  await addTask(page, 'スマホ')

  // The page is laid out as wide as the phone (not the 980px a phone assumes without a viewport
  // tag), and nothing sticks out sideways.
  const { layoutWidth, overflow } = await page.evaluate(() => ({
    layoutWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  expect(layoutWidth).toBeLessThanOrEqual(480)
  expect(overflow).toBeLessThanOrEqual(0)

  await card(page, 'スマホ').getByLabel('スマホのステータス').selectOption('done')
  await expect.poll(() => titles(page, 'done')).toEqual(['スマホ'])
})
