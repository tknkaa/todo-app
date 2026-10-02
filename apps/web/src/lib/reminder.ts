export const DEFAULT_REMIND_BEFORE_MINUTES = 24 * 60
export const MAX_REMIND_BEFORE_MINUTES = 30 * 24 * 60

export const REMIND_OPTIONS = [
  { minutes: 60, label: '1時間前' },
  { minutes: 3 * 60, label: '3時間前' },
  { minutes: 24 * 60, label: '1日前' },
  { minutes: 2 * 24 * 60, label: '2日前' },
  { minutes: 3 * 24 * 60, label: '3日前' },
  { minutes: 7 * 24 * 60, label: '1週間前' },
] as const

export function formatRemindBefore(minutes: number) {
  const preset = REMIND_OPTIONS.find((option) => option.minutes === minutes)
  if (preset) return preset.label
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)}日前`
  if (minutes % 60 === 0) return `${minutes / 60}時間前`
  return `${minutes}分前`
}

export type ReminderState = { dueAt: string | null; remindBeforeMinutes: number | null }

export type ReminderResolution = { ok: true; value: ReminderState } | { ok: false; message: string }

/**
 * Combines a task's current reminder state with a change. A reminder needs a deadline:
 * clearing the deadline turns the reminder off, and turning it on without one is an error.
 */
export function resolveReminder(
  current: ReminderState,
  changes: { dueAt?: string | null; remindBeforeMinutes?: number | null },
): ReminderResolution {
  const dueAt = changes.dueAt === undefined ? current.dueAt : changes.dueAt
  let remindBeforeMinutes =
    changes.remindBeforeMinutes === undefined
      ? current.remindBeforeMinutes
      : changes.remindBeforeMinutes

  if (dueAt === null) {
    if (changes.remindBeforeMinutes != null) {
      return { ok: false, message: 'リマインドを設定するには締め切りが必要です。' }
    }
    remindBeforeMinutes = null
  }
  return { ok: true, value: { dueAt, remindBeforeMinutes } }
}

/** Reads the reminder fields of a form: null when the checkbox is off or the value is unusable. */
export function readReminder(formData: FormData): number | null {
  if (formData.get('remind') !== 'on') return null
  const minutes = Number(formData.get('remindBefore'))
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null
}
