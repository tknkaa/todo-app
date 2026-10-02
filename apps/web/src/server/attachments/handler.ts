import type { D1AttachmentRepository, D1TaskRepository } from '@todo/db'
import {
  attachmentDisposition,
  attachmentKey,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
} from '@/lib/attachment'

export interface ObjectStore {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>
  get(key: string): Promise<ReadableStream | ArrayBuffer | null>
  delete(keys: string[]): Promise<void>
}

export interface AttachmentDeps {
  tasks: D1TaskRepository
  attachments: D1AttachmentRepository
  store: ObjectStore
  newId?: () => string
}

export function objectStoreFromR2(bucket: R2Bucket): ObjectStore {
  return {
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } })
    },
    async get(key) {
      const object = await bucket.get(key)
      return object ? object.body : null
    },
    async delete(keys) {
      if (keys.length > 0) await bucket.delete(keys)
    },
  }
}

/** Removes a task's files from the store. Call before deleting the task row. */
export async function deleteTaskAttachments(deps: AttachmentDeps, userId: string, taskId: string) {
  const items = await deps.attachments.listByTask(userId, taskId)
  await deps.store.delete(items.map((item) => item.r2Key))
}

export async function handleAttachmentsRequest(
  request: Request,
  deps: AttachmentDeps,
  userId: string,
): Promise<Response> {
  const { pathname } = new URL(request.url)
  const newId = deps.newId ?? (() => crypto.randomUUID())

  const forTask = pathname.match(/^\/api\/tasks\/([^/]+)\/attachments$/)
  if (forTask) {
    const taskId = decode(forTask[1])
    if (taskId === null) return json({ error: 'Invalid task id' }, 400)
    if (!(await deps.tasks.findOwned(userId, taskId))) {
      return json({ error: 'タスクが見つかりません。' }, 404)
    }

    if (request.method === 'GET') {
      const items = await deps.attachments.listByTask(userId, taskId)
      return json(items.map(publicAttachment))
    }

    if (request.method === 'POST') {
      const declared = Number(request.headers.get('content-length') ?? 0)
      if (declared > MAX_ATTACHMENT_BYTES + 64 * 1024) {
        return json({ error: 'ファイルは 5 MB 以下にしてください。' }, 413)
      }

      const form = await request.formData().catch(() => null)
      const file = form?.get('file')
      if (!(file instanceof File)) return json({ error: 'file を指定してください。' }, 400)

      const check = validateAttachment(file, await deps.attachments.countByTask(userId, taskId))
      if (!check.ok) return json({ error: check.message }, 400)

      const id = newId()
      const key = attachmentKey(userId, taskId, id)
      const contentType = file.type || 'application/octet-stream'
      await deps.store.put(key, await file.arrayBuffer(), contentType)
      try {
        await deps.attachments.create({
          id,
          taskId,
          userId,
          filename: file.name,
          contentType,
          size: file.size,
          r2Key: key,
        })
      } catch (error) {
        await deps.store.delete([key])
        throw error
      }
      const created = await deps.attachments.find(userId, id)
      return json(created ? publicAttachment(created) : null, 201)
    }

    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
  }

  const single = pathname.match(/^\/api\/attachments\/([^/]+)$/)
  if (!single) return json({ error: 'Not found' }, 404)
  const id = decode(single[1])
  if (id === null) return json({ error: 'Invalid attachment id' }, 400)

  const attachment = await deps.attachments.find(userId, id)
  if (!attachment) return json({ error: '添付ファイルが見つかりません。' }, 404)

  if (request.method === 'GET') {
    const body = await deps.store.get(attachment.r2Key)
    if (!body) return json({ error: '添付ファイルが見つかりません。' }, 404)
    return new Response(body, {
      headers: {
        'Content-Type': attachment.contentType,
        'Content-Disposition': attachmentDisposition(attachment.filename),
        'Content-Length': String(attachment.size),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  }

  if (request.method === 'DELETE') {
    await deps.store.delete([attachment.r2Key])
    await deps.attachments.delete(userId, id)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, DELETE' })
}

function publicAttachment(item: {
  id: string
  taskId: string
  filename: string
  contentType: string
  size: number
  createdAt: string
}) {
  return {
    id: item.id,
    taskId: item.taskId,
    filename: item.filename,
    contentType: item.contentType,
    size: item.size,
    createdAt: item.createdAt,
  }
}

function decode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers })
}
