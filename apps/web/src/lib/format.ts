export function formatDueDate(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

/** Value for `<input type="datetime-local">` (local time, minutes precision); '' when there is no deadline. */
export function toDateTimeLocal(
  value: string | null,
  offsetMinutes = value ? new Date(value).getTimezoneOffset() : 0,
) {
  if (!value) return ''
  const local = new Date(new Date(value).getTime() - offsetMinutes * 60_000)
  return local.toISOString().slice(0, 16)
}
