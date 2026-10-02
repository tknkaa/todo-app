import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import type { Task } from '@todo/domain'

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
    <main className="page-shell">
      <header className="page-header">
        <span className="eyebrow">YOUR SPACE</span>
        <h1>今日を、ひとつずつ。</h1>
        <p>やることを整理して、大切な締め切りに集中しよう。</p>
      </header>

      <section className="task-panel" aria-labelledby="new-task-heading">
        <h2 id="new-task-heading">タスクを追加</h2>
        <form className="task-form" onSubmit={addTask}>
          <label className="sr-only" htmlFor="task-title">タスク名</label>
          <input id="task-title" name="title" placeholder="次にやることは？" maxLength={200} required />
          <label className="sr-only" htmlFor="task-due">締め切り</label>
          <input id="task-due" name="dueAt" type="datetime-local" aria-label="締め切り" />
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? '追加中…' : '追加する'}
          </button>
        </form>
      </section>

      {error && <p className="error-message" role="alert">{error}</p>}

      <section className="task-section" aria-labelledby="task-list-heading">
        <div className="section-heading">
          <h2 id="task-list-heading">タスク</h2>
          <span className="task-count">{tasks.filter((task) => !task.completedAt).length} 件</span>
        </div>
        {loading ? <p className="empty-state">読み込み中…</p> : tasks.length === 0 ? (
          <p className="empty-state">タスクはまだありません。ひとつ追加して始めましょう。</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li className={`task-item${task.completedAt ? ' is-complete' : ''}`} key={task.id}>
                <input
                  aria-label={`${task.title}を${task.completedAt ? '未完了に戻す' : '完了にする'}`}
                  type="checkbox"
                  checked={Boolean(task.completedAt)}
                  onChange={() => void toggleTask(task)}
                />
                <div className="task-copy">
                  <span className="task-title">{task.title}</span>
                  {task.dueAt && <time dateTime={task.dueAt}>{formatDueDate(task.dueAt)}</time>}
                </div>
                <button className="delete-button" type="button" onClick={() => void removeTask(task.id)} aria-label={`${task.title}を削除`}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer className="page-footer">小さな一歩も、前進です。</footer>
    </main>
  )
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
