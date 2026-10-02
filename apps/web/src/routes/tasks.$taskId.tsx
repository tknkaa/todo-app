import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Task, TaskStatus } from '@todo/db'
import { ReminderFields } from '@/components/reminder-fields'
import { TaskAttachments } from '@/components/task-attachments'
import { TaskSharing } from '@/components/task-sharing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLive } from '@/hooks/use-live'
import { useRequireSession } from '@/hooks/use-require-session'
import { messageOf, responseError } from '@/lib/api'
import { toDateTimeLocal } from '@/lib/format'
import { readReminder } from '@/lib/reminder'
import { STATUS_LABELS, TASK_STATUSES, isTaskStatus } from '@/lib/status'

export const Route = createFileRoute('/tasks/$taskId')({
  component: TaskPage,
})

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; task: Task }

function TaskPage() {
  const { taskId } = Route.useParams()
  const session = useRequireSession()

  if (!session) return <main className="mx-auto max-w-[760px] px-5 pt-24" />
  return <TaskDetail taskId={taskId} userId={session.user.id} email={session.user.email} />
}

function TaskDetail({ taskId, userId, email }: { taskId: string; userId: string; email: string }) {
  const navigate = useNavigate()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchTask = useCallback(async (): Promise<Load> => {
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`)
    if (response.status === 404) return { state: 'missing' }
    if (!response.ok) throw new Error(await responseError(response))
    return { state: 'ready', task: (await response.json()) as Task }
  }, [taskId])

  const reload = useCallback(async () => {
    try {
      setLoad(await fetchTask())
    } catch (cause) {
      setError(messageOf(cause, 'タスクを読み込めませんでした。'))
    }
  }, [fetchTask])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const loaded = await fetchTask()
        if (active) setLoad(loaded)
      } catch (cause) {
        if (active) setError(messageOf(cause, 'タスクを読み込めませんでした。'))
      }
    })()
    return () => {
      active = false
    }
  }, [fetchTask])

  // Someone else edited, shared or deleted the task.
  useLive(() => void reload())

  async function patch(body: Record<string, unknown>) {
    setError('')
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await responseError(response))
      await reload()
      return true
    } catch (cause) {
      setError(messageOf(cause, 'タスクを更新できませんでした。'))
      return false
    }
  }

  async function save(event: FormEvent<HTMLFormElement>, isOwner: boolean) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const dueAtLocal = String(formData.get('dueAt') ?? '')
    setSaving(true)
    await patch({
      title: String(formData.get('title') ?? ''),
      dueAt: dueAtLocal ? new Date(dueAtLocal).toISOString() : null,
      // Only the owner may change the reminder.
      ...(isOwner ? { remindBeforeMinutes: dueAtLocal ? readReminder(formData) : null } : {}),
    })
    setSaving(false)
  }

  async function leaveBoard(path: string, method: string, failure: string) {
    setError('')
    try {
      const response = await fetch(path, { method })
      if (!response.ok) throw new Error(await responseError(response))
      await navigate({ to: '/' })
    } catch (cause) {
      setError(messageOf(cause, failure))
    }
  }

  return (
    <main className="mx-auto w-full max-w-[760px] px-5 pt-10 pb-12 md:pt-16">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← ボードに戻る
      </Link>

      {load.state === 'loading' && !error && (
        <p className="mt-10 text-sm text-muted-foreground">読み込み中…</p>
      )}

      {load.state === 'missing' && (
        <p className="mt-10 rounded-xl border border-dashed px-5 py-7 text-center text-sm text-muted-foreground">
          タスクが見つかりません。削除されたか、共有が解除された可能性があります。
        </p>
      )}

      {error && (
        <p
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {load.state === 'ready' && (
        <TaskForm
          // Start over from the saved values whenever the task changes.
          key={`${load.task.title}|${load.task.dueAt}|${load.task.remindBeforeMinutes}`}
          task={load.task}
          isOwner={load.task.userId === userId}
          saving={saving}
          onSubmit={save}
          onStatus={(status) => void patch({ status })}
          onDelete={() =>
            void leaveBoard(
              `/api/tasks/${encodeURIComponent(taskId)}`,
              'DELETE',
              'タスクを削除できませんでした。',
            )
          }
          onLeave={() =>
            void leaveBoard(
              `/api/tasks/${encodeURIComponent(taskId)}/members/${encodeURIComponent(email)}`,
              'DELETE',
              '共有から外れられませんでした。',
            )
          }
        />
      )}
    </main>
  )
}

function TaskForm({
  task,
  isOwner,
  saving,
  onSubmit,
  onStatus,
  onDelete,
  onLeave,
}: {
  task: Task
  isOwner: boolean
  saving: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>, isOwner: boolean) => void
  onStatus: (status: TaskStatus) => void
  onDelete: () => void
  onLeave: () => void
}) {
  return (
    <div className="mt-8 grid gap-8">
      <form className="grid gap-4" onSubmit={(event) => onSubmit(event, isOwner)}>
        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="detail-title">
            タスク名
          </label>
          <Input
            id="detail-title"
            name="title"
            className="h-12 text-lg font-semibold"
            defaultValue={task.title}
            maxLength={200}
            required
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label htmlFor="detail-status">ステータス</label>
          <select
            id="detail-status"
            className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            value={task.status}
            onChange={(event) => {
              if (isTaskStatus(event.target.value)) onStatus(event.target.value)
            }}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          {!isOwner && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              共有されたタスク
            </span>
          )}
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="detail-due">
            締め切り
          </label>
          <Input
            id="detail-due"
            name="dueAt"
            type="datetime-local"
            className="h-10 max-w-[260px]"
            defaultValue={toDateTimeLocal(task.dueAt)}
          />
        </div>

        {isOwner && <ReminderFields defaultMinutes={task.remindBeforeMinutes} />}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
          {isOwner ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              タスクを削除
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onLeave}
            >
              共有から外れる
            </Button>
          )}
        </div>
      </form>

      {isOwner && (
        <>
          <section className="grid gap-2" aria-labelledby="detail-attachments">
            <h2 id="detail-attachments" className="text-[15px] font-semibold">
              添付ファイル
            </h2>
            <TaskAttachments taskId={task.id} title={task.title} />
          </section>
          <section className="grid gap-2" aria-labelledby="detail-sharing">
            <h2 id="detail-sharing" className="text-[15px] font-semibold">
              共有
            </h2>
            <TaskSharing taskId={task.id} title={task.title} />
          </section>
        </>
      )}
    </div>
  )
}
