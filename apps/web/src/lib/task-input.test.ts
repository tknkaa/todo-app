import { describe, expect, it } from 'vitest'
import { completionTimestamp, parseCreateTaskInput, parseUpdateTaskInput } from './task-input'

describe('parseCreateTaskInput', () => {
  it('trims the title and converts the deadline to UTC', () => {
    expect(
      parseCreateTaskInput({ title: '  Submit report  ', dueAt: '2026-10-03T09:30:00+09:00' }),
    ).toEqual({
      ok: true,
      value: {
        title: 'Submit report',
        dueAt: '2026-10-03T00:30:00.000Z',
        remindBeforeMinutes: null,
      },
    })
  })

  it.each([undefined, null, ''])('treats a missing deadline (%j) as null', (dueAt) => {
    expect(parseCreateTaskInput({ title: 'Task', dueAt })).toEqual({
      ok: true,
      value: { title: 'Task', dueAt: null, remindBeforeMinutes: null },
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

describe('parseUpdateTaskInput', () => {
  it('keeps only the fields that were given', () => {
    expect(parseUpdateTaskInput({ completed: true })).toEqual({
      ok: true,
      value: { completed: true },
    })
    expect(parseUpdateTaskInput({ title: '  new  ' })).toEqual({
      ok: true,
      value: { title: 'new' },
    })
  })

  it('normalizes the deadline and allows clearing it', () => {
    expect(parseUpdateTaskInput({ dueAt: '2026-10-03T09:30:00+09:00' })).toEqual({
      ok: true,
      value: { dueAt: '2026-10-03T00:30:00.000Z' },
    })
    expect(parseUpdateTaskInput({ dueAt: null })).toEqual({ ok: true, value: { dueAt: null } })
    expect(parseUpdateTaskInput({ dueAt: '' })).toEqual({ ok: true, value: { dueAt: null } })
  })

  it('requires at least one field', () => {
    expect(parseUpdateTaskInput({})).toEqual({
      ok: false,
      message: '変更する項目を指定してください。',
    })
  })

  it.each([
    [{ title: '   ' }, 'タイトルは1〜200文字で入力してください。'],
    [{ dueAt: 'nope' }, '締め切りの日時が正しくありません。'],
    [{ completed: 'yes' }, 'completed は boolean で指定してください。'],
  ])('rejects %j', (input, message) => {
    expect(parseUpdateTaskInput(input)).toEqual({ ok: false, message })
  })

  it('rejects a body that is not an object', () => {
    expect(parseUpdateTaskInput(null).ok).toBe(false)
  })
})

describe('reminder setting in task input', () => {
  it('is off by default when creating', () => {
    const result = parseCreateTaskInput({ title: 'Task', dueAt: '2030-01-01T00:00:00Z' })
    expect(result.ok && result.value.remindBeforeMinutes).toBeNull()
  })

  it('accepts a number of minutes when creating and updating', () => {
    const created = parseCreateTaskInput({ title: 'Task', remindBeforeMinutes: 1440 })
    expect(created.ok && created.value.remindBeforeMinutes).toBe(1440)
    expect(parseUpdateTaskInput({ remindBeforeMinutes: 60 })).toEqual({
      ok: true,
      value: { remindBeforeMinutes: 60 },
    })
    expect(parseUpdateTaskInput({ remindBeforeMinutes: null })).toEqual({
      ok: true,
      value: { remindBeforeMinutes: null },
    })
  })

  it.each([0, -5, 1.5, 43_201, '60', true])('rejects %j', (remindBeforeMinutes) => {
    const message = 'リマインドの時間が正しくありません。'
    expect(parseCreateTaskInput({ title: 'Task', remindBeforeMinutes })).toEqual({
      ok: false,
      message,
    })
    expect(parseUpdateTaskInput({ remindBeforeMinutes })).toEqual({ ok: false, message })
  })
})
