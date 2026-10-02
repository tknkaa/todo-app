import { useEffect, useState, type ChangeEvent } from 'react'
import type { Attachment } from '@todo/db'
import { Button } from '@/components/ui/button'
import { messageOf, responseError } from '@/lib/api'
import { formatBytes } from '@/lib/attachment'

type PublicAttachment = Omit<Attachment, 'r2Key' | 'userId'>

export function TaskAttachments({ taskId, title }: { taskId: string; title: string }) {
  const [items, setItems] = useState<PublicAttachment[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (items !== null) return
    let active = true
    void (async () => {
      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/attachments`)
        if (!response.ok) throw new Error(await responseError(response))
        const loaded = (await response.json()) as PublicAttachment[]
        if (active) setItems(loaded)
      } catch (cause) {
        if (active) setError(messageOf(cause, '添付ファイルを読み込めませんでした。'))
      }
    })()
    return () => {
      active = false
    }
  }, [items, taskId])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const form = new FormData()
    form.set('file', file)
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/attachments`, {
        method: 'POST',
        body: form,
      })
      if (!response.ok) throw new Error(await responseError(response))
      const created = (await response.json()) as PublicAttachment
      setItems((current) => [...(current ?? []), created])
    } catch (cause) {
      setError(messageOf(cause, '添付できませんでした。'))
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  async function remove(id: string) {
    setError('')
    try {
      const response = await fetch(`/api/attachments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await responseError(response))
      setItems((current) => (current ?? []).filter((item) => item.id !== id))
    } catch (cause) {
      setError(messageOf(cause, '削除できませんでした。'))
    }
  }

  return (
    <div className="grid gap-2 pl-2 text-xs">
      {items?.map((item) => (
        <div className="flex items-center gap-3" key={item.id}>
          <a
            className="min-w-0 flex-1 truncate underline underline-offset-2"
            href={`/api/attachments/${encodeURIComponent(item.id)}`}
            download
          >
            {item.filename}
          </a>
          <span className="text-muted-foreground">{formatBytes(item.size)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            type="button"
            onClick={() => void remove(item.id)}
            aria-label={`${item.filename}を削除`}
          >
            削除
          </Button>
        </div>
      ))}
      <label className="w-fit">
        <span className="sr-only">{title}にファイルを添付</span>
        <input
          type="file"
          disabled={busy}
          onChange={(event) => void upload(event)}
          className="text-xs file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-xs"
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        1 ファイル 5 MB まで、1 タスクに 5 件まで。
      </p>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
