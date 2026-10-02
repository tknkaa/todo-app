import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Task, TaskStatus } from '@todo/db'
import { KanbanBoard } from '@/components/kanban-board'
import { ReminderFields } from '@/components/reminder-fields'
import type { TaskChanges } from '@/components/task-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLive } from '@/hooks/use-live'
import { useRequireSession } from '@/hooks/use-require-session'
import { authClient } from '@/lib/auth-client'
import { responseError } from '@/lib/api'
import { readReminder } from '@/lib/reminder'
import { moveTask } from '@/lib/status'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const session = useRequireSession()

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

  async function moveStatus(taskId: string, status: TaskStatus) {
    const previous = tasks.find((task) => task.id === taskId)
    if (!previous || previous.status === status) return
    setTasks((current) => moveTask(current, taskId, status, new Date()))
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error(await responseError(response))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '状態を更新できませんでした。')
      await loadTasks()
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

  async function saveTask(task: Task, changes: TaskChanges) {
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
        `/api/tasks/${encodeURIComponent(taskId)}/members/${encodeURIComponent(email)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) throw new Error(await responseError(response))
      setTasks((current) => current.filter((task) => task.id !== taskId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '共有から外れられませんでした。')
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 pt-14 pb-8 md:pt-22">
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
            {tasks.filter((task) => task.status !== 'done').length} 件
          </span>
        </div>
        {loading ? (
          <EmptyMessage>読み込み中…</EmptyMessage>
        ) : (
          <KanbanBoard
            tasks={tasks}
            userId={userId}
            onMove={(taskId, status) => void moveStatus(taskId, status)}
            onRemove={(taskId) => void removeTask(taskId)}
            onLeave={(taskId) => void leaveTask(taskId)}
            onSave={saveTask}
          />
        )}
      </section>
      <footer className="mt-12 text-center text-[11px] tracking-[0.08em] text-muted-foreground">
        小さな一歩も、前進です。
      </footer>
    </main>
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
