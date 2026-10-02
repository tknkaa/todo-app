import { useState, type FormEvent } from 'react'
import type { Task, TaskStatus } from '@todo/db'
import { ReminderFields } from '@/components/reminder-fields'
import { TaskAttachments } from '@/components/task-attachments'
import { TaskSharing } from '@/components/task-sharing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDueDate, toDateTimeLocal } from '@/lib/format'
import { formatRemindBefore, readReminder } from '@/lib/reminder'
import { STATUS_LABELS, TASK_STATUSES, isTaskStatus } from '@/lib/status'

export type TaskChanges = {
  title: string
  dueAt: string | null
  remindBeforeMinutes?: number | null
}

export function TaskCard({
  task,
  isOwner,
  onMove,
  onRemove,
  onLeave,
  onSave,
}: {
  task: Task
  isOwner: boolean
  onMove: (status: TaskStatus) => void
  onRemove: () => void
  onLeave: () => void
  onSave: (changes: TaskChanges) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const dueAtLocal = String(formData.get('dueAt') ?? '')
    const saved = await onSave({
      title: String(formData.get('title') ?? ''),
      dueAt: dueAtLocal ? new Date(dueAtLocal).toISOString() : null,
      // Only the owner may change the reminder, so a member's save leaves it alone.
      ...(isOwner ? { remindBeforeMinutes: dueAtLocal ? readReminder(formData) : null } : {}),
    })
    if (saved) setEditing(false)
  }

  return (
    // Dragging is a pointer shortcut; the status select below is the keyboard and touch way.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      className="grid cursor-grab gap-2 rounded-xl border bg-card p-3.5 shadow-xs active:cursor-grabbing"
      draggable={!editing}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
    >
      {editing ? (
        <form className="grid gap-2" onSubmit={submit}>
          <Input
            name="title"
            className="h-9"
            defaultValue={task.title}
            aria-label="タスク名"
            maxLength={200}
            required
          />
          <Input
            name="dueAt"
            type="datetime-local"
            className="h-9"
            defaultValue={toDateTimeLocal(task.dueAt)}
            aria-label="締め切り"
          />
          {isOwner && <ReminderFields defaultMinutes={task.remindBeforeMinutes} />}
          <div className="flex gap-1">
            <Button className="h-9" type="submit">
              保存
            </Button>
            <Button className="h-9" variant="ghost" type="button" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span
            className={`break-words text-sm font-medium${task.status === 'done' ? ' text-muted-foreground line-through' : ''}`}
          >
            {task.title}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {task.dueAt && <time dateTime={task.dueAt}>{formatDueDate(task.dueAt)}</time>}
            {task.remindBeforeMinutes !== null && (
              <span>リマインド: {formatRemindBefore(task.remindBeforeMinutes)}</span>
            )}
            {!isOwner && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                共有されたタスク
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <select
              className="h-8 rounded-md border bg-background px-1.5 text-xs"
              value={task.status}
              aria-label={`${task.title}のステータス`}
              onChange={(event) => {
                if (isTaskStatus(event.target.value)) onMove(event.target.value)
              }}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`${task.title}を編集`}
            >
              編集
            </Button>
            {isOwner ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                type="button"
                onClick={onRemove}
                aria-label={`${task.title}を削除`}
              >
                削除
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                type="button"
                onClick={onLeave}
                aria-label={`${task.title}の共有から外れる`}
              >
                共有から外れる
              </Button>
            )}
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-x-3">
              <TaskAttachments taskId={task.id} title={task.title} />
              <TaskSharing taskId={task.id} title={task.title} />
            </div>
          )}
        </>
      )}
    </li>
  )
}
