import { useEffect, useId, useRef, useState } from 'react'
import { DEFAULT_REMIND_BEFORE_MINUTES, formatRemindBefore, REMIND_OPTIONS } from '@/lib/reminder'

/** Checkbox plus a lead-time select. Form fields: `remind` and `remindBefore` (see readReminder). */
export function ReminderFields({
  defaultMinutes,
  className,
}: {
  defaultMinutes: number | null
  className?: string
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(defaultMinutes !== null)

  // `form.reset()` restores the DOM but not React state, so put the checkbox back to its default too.
  useEffect(() => {
    const form = root.current?.closest('form')
    const reset = () => setEnabled(defaultMinutes !== null)
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [defaultMinutes])
  const current = defaultMinutes ?? DEFAULT_REMIND_BEFORE_MINUTES
  const options = REMIND_OPTIONS.some((option) => option.minutes === current)
    ? REMIND_OPTIONS
    : [...REMIND_OPTIONS, { minutes: current, label: formatRemindBefore(current) }]

  return (
    <div ref={root} className={`flex flex-wrap items-center gap-3 text-xs ${className ?? ''}`}>
      <label className="flex items-center gap-2" htmlFor={`${id}-on`}>
        <input
          id={`${id}-on`}
          type="checkbox"
          name="remind"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        メールでリマインドする
      </label>
      <select
        name="remindBefore"
        aria-label="リマインドの時期"
        className="h-8 rounded-md border bg-background px-2 disabled:opacity-50"
        defaultValue={current}
        disabled={!enabled}
      >
        {options.map((option) => (
          <option key={option.minutes} value={option.minutes}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">締め切りが設定されているタスクだけ届きます</span>
    </div>
  )
}
