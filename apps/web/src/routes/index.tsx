import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Task } from '@todo/db'
import { ReminderFields } from '@/components/reminder-fields'
import { TaskAttachments } from '@/components/task-attachments'
import { TaskSharing } from '@/components/task-sharing'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useLive } from '@/hooks/use-live'
import { authClient } from '@/lib/auth-client'
import { formatDueDate, toDateTimeLocal } from '@/lib/format'
import { formatRemindBefore, readReminder } from '@/lib/reminder'
import { completionTimestamp } from '@/lib/task-input'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session) void navigate({ to: '/login' })
  }, [isPending, session, navigate])

  if (!session) return <main className="mx-auto max-w-[800px] px-5 pt-24" />

  return (
    <TaskBoard
      userId={session.user.id}
      email={session.user.email}
      onSignOut={async () => {
        await authClient.signOut()
        await navigate({ to: '/login' })
      }}
    />
  )
}

function TaskBoard({
  userId,
  email,
  onSignOut,
}: {
  userId: string
  email: string
  onSignOut: () => Promise<void>
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadTasks = useCallback(async () => {
    try {
      setTasks(await fetchTasks())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'タスクを読み込めませんでした。')
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const loadedTasks = await fetchTasks()
        if (active) {
          setTasks(loadedTasks)
          setError('')
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'タスクを読み込めませんでした。')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Another tab, or someone the task is shared with, changed something.
  useLive(() => void loadTasks())

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '')
    const dueAtLocal = String(formData.get('dueAt') ?? '')
    const remindBeforeMinutes = dueAtLocal ? readReminder(formData) : null
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          dueAt: dueAtLocal ? new Date(dueAtLocal).toISOString() : null,
          remindBeforeMinutes,
        }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const task = (await response.json()) as Task
      setTasks((current) => [task, ...current])
      form.reset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'タスクを追加できませんでした。')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task: Task) {
    const completed = !task.completedAt
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, completedAt: completionTimestamp(completed, new Date()) }
            : item,
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '状態を更新できませんでした。')
    }
  }

  async function removeTask(taskId: string) {
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await responseError(response))
      setTasks((current) => current.filter((task) => task.id !== taskId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'タスクを削除できませんでした。')
    }
  }

  async function saveTask(
    task: Task,
    changes: { title: string; dueAt: string | null; remindBeforeMinutes?: number | null },
  ) {
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (!response.ok) throw new Error(await responseError(response))
      await loadTasks()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'タスクを更新できませんでした。')
      return false
    }
  }

  async function leaveTask(taskId: string) {
    try {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}/members/${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) throw new Error(await responseError(response))
      setTasks((current) => current.filter((task) => task.id !== taskId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '共有から外れられませんでした。')
    }
  }

  return (
    <main className="mx-auto w-full max-w-[800px] px-5 pt-14 pb-8 md:pt-22">
      <header className="mb-10">
        <div className="mb-6 flex items-center justify-end gap-3 text-xs text-muted-foreground">
          <span>{email}</span>
          <Button variant="ghost" size="sm" type="button" onClick={() => void onSignOut()}>
            ログアウト
          </Button>
        </div>
        <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground">
          YOUR SPACE
        </span>
        <h1 className="mt-3 mb-2 text-3xl font-semibold tracking-[-0.055em] md:text-[42px]">
          今日を、ひとつずつ。
        </h1>
        <p className="text-sm text-muted-foreground">
          やることを整理して、大切な締め切りに集中しよう。
        </p>
      </header>

      <section
        className="rounded-2xl border bg-card p-5 shadow-sm md:p-6"
        aria-labelledby="new-task-heading"
      >
        <h2 id="new-task-heading" className="text-[15px] font-semibold">
          タスクを追加
        </h2>
        <form
          className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_210px_auto]"
          onSubmit={addTask}
        >
          <label className="sr-only" htmlFor="task-title">
            タスク名
          </label>
          <Input
            id="task-title"
            name="title"
            className="h-11 bg-muted/40"
            placeholder="次にやることは？"
            maxLength={200}
            required
          />
          <label className="sr-only" htmlFor="task-due">
            締め切り
          </label>
          <Input
            id="task-due"
            name="dueAt"
            type="datetime-local"
            aria-label="締め切り"
            className="h-11 bg-muted/40"
          />
          <Button className="h-11 px-5" type="submit" disabled={saving}>
            {saving ? '追加中…' : '追加する'}
          </Button>
          <ReminderFields defaultMinutes={null} className="sm:col-span-3" />
        </form>
      </section>

      {error && (
        <p
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="mt-10" aria-labelledby="task-list-heading">
        <div className="mb-3.5 flex items-center gap-2.5">
          <h2 id="task-list-heading" className="text-[15px] font-semibold">
            タスク
          </h2>
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground">
            {tasks.filter((task) => !task.completedAt).length} 件
          </span>
        </div>
        {loading ? (
          <EmptyMessage>読み込み中…</EmptyMessage>
        ) : tasks.length === 0 ? (
          <EmptyMessage>タスクはまだありません。ひとつ追加して始めましょう。</EmptyMessage>
        ) : (
          <ul className="grid gap-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isOwner={task.userId === userId}
                onToggle={() => void toggleTask(task)}
                onRemove={() => void removeTask(task.id)}
                onLeave={() => void leaveTask(task.id)}
                onSave={(changes) => saveTask(task, changes)}
              />
            ))}
          </ul>
        )}
      </section>
      <footer className="mt-12 text-center text-[11px] tracking-[0.08em] text-muted-foreground">
        小さな一歩も、前進です。
      </footer>
    </main>
  )
}

function TaskRow({
  task,
  isOwner,
  onToggle,
  onRemove,
  onLeave,
  onSave,
}: {
  task: Task
  isOwner: boolean
  onToggle: () => void
  onRemove: () => void
  onLeave: () => void
  onSave: (changes: {
    title: string
    dueAt: string | null
    remindBeforeMinutes?: number | null
  }) => Promise<boolean>
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
    <li className="grid gap-1 rounded-xl border bg-card px-4 py-3.5">
      <div className="flex min-h-[40px] items-center gap-3.5">
        <Checkbox
          aria-label={`${task.title}を${task.completedAt ? '未完了に戻す' : '完了にする'}`}
          checked={Boolean(task.completedAt)}
          onCheckedChange={onToggle}
        />
        {editing ? (
          <form
            className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_210px_auto]"
            onSubmit={submit}
          >
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
            {isOwner && (
              <ReminderFields defaultMinutes={task.remindBeforeMinutes} className="sm:col-span-3" />
            )}
            <div className="flex gap-1">
              <Button className="h-9" type="submit">
                保存
              </Button>
              <Button
                className="h-9"
                variant="ghost"
                type="button"
                onClick={() => setEditing(false)}
              >
                取消
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid min-w-0 flex-1 gap-1">
              <span
                className={`break-words text-sm font-medium${task.completedAt ? ' text-muted-foreground line-through' : ''}`}
              >
                {task.title}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
            </div>
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
          </>
        )}
      </div>
      {isOwner && (
        <div className="flex flex-wrap gap-x-4">
          <TaskAttachments taskId={task.id} title={task.title} />
          <TaskSharing taskId={task.id} title={task.title} />
        </div>
      )}
    </li>
  )
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed px-5 py-7 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

async function fetchTasks() {
  const response = await fetch('/api/tasks')
  if (!response.ok) throw new Error(await responseError(response))
  return (await response.json()) as Task[]
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? 'リクエストに失敗しました。'
}
