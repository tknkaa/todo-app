import { useEffect, useState, type FormEvent } from 'react'
import type { TaskMember } from '@todo/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function TaskSharing({ taskId, title }: { taskId: string; title: string }) {
  const [members, setMembers] = useState<TaskMember[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const base = `/api/tasks/${encodeURIComponent(taskId)}/members`

  useEffect(() => {
    if (members !== null) return
    let active = true
    void (async () => {
      try {
        const response = await fetch(base)
        if (!response.ok) throw new Error(await responseError(response))
        const loaded = (await response.json()) as TaskMember[]
        if (active) setMembers(loaded)
      } catch (cause) {
        if (active) setError(messageOf(cause, '共有相手を読み込めませんでした。'))
      }
    })()
    return () => {
      active = false
    }
  }, [members, base])

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const email = String(new FormData(form).get('email') ?? '')
    setBusy(true)
    setError('')
    try {
      const response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      setMembers((await response.json()) as TaskMember[])
      form.reset()
    } catch (cause) {
      setError(messageOf(cause, '共有できませんでした。'))
    } finally {
      setBusy(false)
    }
  }

  async function unshare(userId: string) {
    setError('')
    try {
      const response = await fetch(`${base}/${encodeURIComponent(userId)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await responseError(response))
      setMembers((current) => (current ?? []).filter((member) => member.userId !== userId))
    } catch (cause) {
      setError(messageOf(cause, '共有を解除できませんでした。'))
    }
  }

  return (
    <div className="grid gap-2 pl-2 text-xs">
      {members?.map((member) => (
        <div className="flex items-center gap-3" key={member.userId}>
          <span className="min-w-0 flex-1 truncate">{member.email}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            type="button"
            onClick={() => void unshare(member.userId)}
            aria-label={`${member.email}との共有を解除`}
          >
            解除
          </Button>
        </div>
      ))}
      <form className="flex gap-2" onSubmit={(event) => void share(event)}>
        <Input
          name="email"
          type="email"
          className="h-9"
          placeholder="共有する相手のメールアドレス"
          aria-label={`${title}を共有する相手のメールアドレス`}
          required
        />
        <Button className="h-9" type="submit" disabled={busy}>
          共有する
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        共有した相手は、タイトル・締め切り・完了を編集できます。削除と添付は所有者だけです。
      </p>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? 'リクエストに失敗しました。'
}

function messageOf(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}
