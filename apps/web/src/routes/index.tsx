import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Task } from '@todo/domain'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    try {
      const response = await fetch('/api/tasks')
      if (!response.ok) throw new Error(await responseError(response))
      setTasks(await response.json() as Task[])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'タスクを読み込めませんでした。')
    } finally {
      setLoading(false)
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '')
    const dueAtLocal = String(formData.get('dueAt') ?? '')
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dueAt: dueAtLocal ? new Date(dueAtLocal).toISOString() : null }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const task = await response.json() as Task
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
      setTasks((current) => current.map((item) => item.id === task.id
        ? { ...item, completedAt: completed ? new Date().toISOString() : null }
        : item))
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

  return (
    <main className="mx-auto w-full max-w-[800px] px-5 pt-14 pb-8 md:pt-22">
      <header className="mb-10">
        <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground">YOUR SPACE</span>
        <h1 className="mt-3 mb-2 text-3xl font-semibold tracking-[-0.055em] md:text-[42px]">今日を、ひとつずつ。</h1>
        <p className="text-sm text-muted-foreground">やることを整理して、大切な締め切りに集中しよう。</p>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6" aria-labelledby="new-task-heading">
        <h2 id="new-task-heading" className="text-[15px] font-semibold">タスクを追加</h2>
        <form className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_210px_auto]" onSubmit={addTask}>
          <label className="sr-only" htmlFor="task-title">タスク名</label>
          <Input id="task-title" name="title" className="h-11 bg-muted/40" placeholder="次にやることは？" maxLength={200} required />
          <label className="sr-only" htmlFor="task-due">締め切り</label>
          <Input id="task-due" name="dueAt" type="datetime-local" aria-label="締め切り" className="h-11 bg-muted/40" />
          <Button className="h-11 px-5" type="submit" disabled={saving}>
            {saving ? '追加中…' : '追加する'}
          </Button>
        </form>
      </section>

      {error && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}

      <section className="mt-10" aria-labelledby="task-list-heading">
        <div className="mb-3.5 flex items-center gap-2.5">
          <h2 id="task-list-heading" className="text-[15px] font-semibold">タスク</h2>
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground">
            {tasks.filter((task) => !task.completedAt).length} 件
          </span>
        </div>
        {loading ? <EmptyMessage>読み込み中…</EmptyMessage> : tasks.length === 0 ? (
          <EmptyMessage>タスクはまだありません。ひとつ追加して始めましょう。</EmptyMessage>
        ) : (
          <ul className="grid gap-2">
            {tasks.map((task) => (
              <li className="flex min-h-[68px] items-center gap-3.5 rounded-xl border bg-card px-4 py-3.5" key={task.id}>
                <Checkbox
                  aria-label={`${task.title}を${task.completedAt ? '未完了に戻す' : '完了にする'}`}
                  checked={Boolean(task.completedAt)}
                  onCheckedChange={() => void toggleTask(task)}
                />
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className={`break-words text-sm font-medium${task.completedAt ? ' text-muted-foreground line-through' : ''}`}>{task.title}</span>
                  {task.dueAt && <time className="text-[11px] text-muted-foreground" dateTime={task.dueAt}>{formatDueDate(task.dueAt)}</time>}
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" type="button" onClick={() => void removeTask(task.id)} aria-label={`${task.title}を削除`}>
                  削除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer className="mt-12 text-center text-[11px] tracking-[0.08em] text-muted-foreground">小さな一歩も、前進です。</footer>
    </main>
  )
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed px-5 py-7 text-center text-sm text-muted-foreground">{children}</p>
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return body?.error ?? 'リクエストに失敗しました。'
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}
