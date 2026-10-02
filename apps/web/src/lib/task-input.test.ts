import { describe, expect, it } from 'vitest'
import { completionTimestamp, parseCreateTaskInput } from './task-input'

describe('parseCreateTaskInput', () => {
  it('trims the title and converts the deadline to UTC', () => {
    expect(
      parseCreateTaskInput({ title: '  Submit report  ', dueAt: '2026-10-03T09:30:00+09:00' }),
    ).toEqual({ ok: true, value: { title: 'Submit report', dueAt: '2026-10-03T00:30:00.000Z' } })
  })

  it.each([undefined, null, ''])('treats a missing deadline (%j) as null', (dueAt) => {
    expect(parseCreateTaskInput({ title: 'Task', dueAt })).toEqual({
      ok: true,
      value: { title: 'Task', dueAt: null },
    })
  })

  it.each(['', '   ', 't'.repeat(201), 42, undefined])('rejects the title %j', (title) => {
    expect(parseCreateTaskInput({ title })).toEqual({
      ok: false,
      message: 'タイトルは1〜200文字で入力してください。',
    })
  })

  it.each(['not-a-date', 123, true])('rejects the deadline %j', (dueAt) => {
    expect(parseCreateTaskInput({ title: 'Task', dueAt })).toEqual({
      ok: false,
      message: '締め切りの日時が正しくありません。',
    })
  })

  it('accepts a title of exactly 200 characters', () => {
    expect(parseCreateTaskInput({ title: 't'.repeat(200) }).ok).toBe(true)
  })
})

describe('completionTimestamp', () => {
  const now = new Date('2026-10-02T01:02:03.000Z')

  it('returns the current time when completing', () => {
    expect(completionTimestamp(true, now)).toBe('2026-10-02T01:02:03.000Z')
  })

  it('returns null when reopening', () => {
    expect(completionTimestamp(false, now)).toBeNull()
  })
})
