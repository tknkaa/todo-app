import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMIND_BEFORE_MINUTES,
  formatRemindBefore,
  readReminder,
  REMIND_OPTIONS,
  resolveReminder,
} from './reminder'

describe('formatRemindBefore', () => {
  it.each([
    [60, '1時間前'],
    [1440, '1日前'],
    [10080, '1週間前'],
    [4 * 1440, '4日前'],
    [5 * 60, '5時間前'],
    [90, '90分前'],
  ])('formats %i minutes as %s', (minutes, label) => {
    expect(formatRemindBefore(minutes)).toBe(label)
  })
})

describe('defaults', () => {
  it('defaults to one day before, which is one of the options', () => {
    expect(DEFAULT_REMIND_BEFORE_MINUTES).toBe(1440)
    expect(REMIND_OPTIONS.some((option) => option.minutes === DEFAULT_REMIND_BEFORE_MINUTES)).toBe(
      true,
    )
  })
})

describe('resolveReminder', () => {
  const due = '2030-01-02T00:00:00.000Z'

  it('turns the reminder on for a task with a deadline', () => {
    expect(
      resolveReminder({ dueAt: due, remindBeforeMinutes: null }, { remindBeforeMinutes: 1440 }),
    ).toEqual({ ok: true, value: { dueAt: due, remindBeforeMinutes: 1440 } })
  })

  it('turns the reminder off', () => {
    expect(
      resolveReminder({ dueAt: due, remindBeforeMinutes: 1440 }, { remindBeforeMinutes: null }),
    ).toEqual({ ok: true, value: { dueAt: due, remindBeforeMinutes: null } })
  })

  it('keeps the reminder when only the deadline changes', () => {
    const next = '2030-02-01T00:00:00.000Z'
    expect(resolveReminder({ dueAt: due, remindBeforeMinutes: 60 }, { dueAt: next })).toEqual({
      ok: true,
      value: { dueAt: next, remindBeforeMinutes: 60 },
    })
  })

  it('turns the reminder off when the deadline is cleared', () => {
    expect(resolveReminder({ dueAt: due, remindBeforeMinutes: 60 }, { dueAt: null })).toEqual({
      ok: true,
      value: { dueAt: null, remindBeforeMinutes: null },
    })
  })

  it('rejects a reminder without a deadline', () => {
    const error = { ok: false, message: 'リマインドを設定するには締め切りが必要です。' }
    expect(
      resolveReminder({ dueAt: null, remindBeforeMinutes: null }, { remindBeforeMinutes: 60 }),
    ).toEqual(error)
    expect(
      resolveReminder(
        { dueAt: due, remindBeforeMinutes: null },
        { dueAt: null, remindBeforeMinutes: 60 },
      ),
    ).toEqual(error)
  })

  it('allows turning the reminder off together with clearing the deadline', () => {
    expect(
      resolveReminder(
        { dueAt: due, remindBeforeMinutes: 60 },
        { dueAt: null, remindBeforeMinutes: null },
      ),
    ).toEqual({ ok: true, value: { dueAt: null, remindBeforeMinutes: null } })
  })
})

describe('readReminder', () => {
  const form = (values: Record<string, string>) => {
    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) formData.set(key, value)
    return formData
  }

  it('is off unless the checkbox is on', () => {
    expect(readReminder(form({ remindBefore: '1440' }))).toBeNull()
    expect(readReminder(form({}))).toBeNull()
  })

  it('returns the chosen minutes when on', () => {
    expect(readReminder(form({ remind: 'on', remindBefore: '60' }))).toBe(60)
  })

  it.each(['', 'abc', '0', '-5', '1.5'])('ignores the unusable value %j', (value) => {
    expect(readReminder(form({ remind: 'on', remindBefore: value }))).toBeNull()
  })
})
