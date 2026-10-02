import type { D1TaskMemberRepository, D1TaskRepository, NotificationMessage } from '@todo/db'
import { resolveReminder } from '@/lib/reminder'
import { statusChange } from '@/lib/status'
import { parseCreateTaskInput, parseUpdateTaskInput } from '@/lib/task-input'

/** Tells the given users that the tasks they can see have changed. */
export type Notify = (userIds: string[]) => Promise<void>

/** Queues a mail. It is sent later by the worker, so a mail problem never fails a request. */
export type SendMail = (message: NotificationMessage) => Promise<void>

export interface TaskDeps {
  tasks: D1TaskRepository
  members: D1TaskMemberRepository
  notify: Notify
  sendMail?: SendMail
  now?: () => Date
}

export async function handleTasksRequest(
  request: Request,
  deps: TaskDeps,
  userId: string,
): Promise<Response> {
  const { pathname } = new URL(request.url)
  const now = deps.now ?? (() => new Date())

  if (pathname === '/api/tasks') {
    if (request.method === 'GET') {
      return json(await deps.tasks.listByUser(userId))
    }

    if (request.method === 'POST') {
      const body = await readJsonObject(request)
      if (!body) return json({ error: 'Invalid JSON body' }, 400)

      const parsed = parseCreateTaskInput(body)
      if (!parsed.ok) return json({ error: parsed.message }, 400)

      const reminder = resolveReminder(
        { dueAt: null, remindBeforeMinutes: null },
        { dueAt: parsed.value.dueAt, remindBeforeMinutes: parsed.value.remindBeforeMinutes },
      )
      if (!reminder.ok) return json({ error: reminder.message }, 400)

      const task = {
        id: crypto.randomUUID(),
        userId,
        title: parsed.value.title,
        status: 'todo' as const,
        completedAt: null,
        ...reminder.value,
      }
      const created = await deps.tasks.create(task)
      await deps.notify([userId])
      return json(created, 201)
    }

    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
  }

  const match = pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (!match) return json({ error: 'Not found' }, 404)

  let taskId: string
  try {
    taskId = decodeURIComponent(match[1])
  } catch {
    return json({ error: 'Invalid task id' }, 400)
  }

  if (request.method === 'GET') {
    const task = await deps.tasks.findAccessible(userId, taskId)
    return task ? json(task) : notFound()
  }

  if (request.method === 'PATCH') {
    const body = await readJsonObject(request)
    if (!body) return json({ error: 'Invalid JSON body' }, 400)
    const parsed = parseUpdateTaskInput(body)
    if (!parsed.ok) return json({ error: parsed.message }, 400)
    const current = await deps.tasks.findAccessible(userId, taskId)
    if (!current) return notFound()

    const { status, title, dueAt, remindBeforeMinutes, position } = parsed.value
    if (remindBeforeMinutes !== undefined && current.userId !== userId) {
      return json({ error: 'リマインドを設定できるのはタスクの所有者だけです。' }, 403)
    }
    const reminder = resolveReminder(current, { dueAt, remindBeforeMinutes })
    if (!reminder.ok) return json({ error: reminder.message }, 400)

    await deps.tasks.update(userId, taskId, {
      title,
      position,
      dueAt,
      remindBeforeMinutes:
        reminder.value.remindBeforeMinutes === current.remindBeforeMinutes
          ? undefined
          : reminder.value.remindBeforeMinutes,
    })
    if (status !== undefined && status !== current.status) {
      const change = statusChange(status, now())
      await deps.tasks.setStatus(userId, taskId, change.status, change.completedAt)
    }
    await deps.notify(await deps.members.accessUserIds(taskId))
    return new Response(null, { status: 204 })
  }

  if (request.method === 'DELETE') {
    if (!(await deps.tasks.findOwned(userId, taskId))) return notFound()
    const audience = await deps.members.accessUserIds(taskId)
    await deps.tasks.delete(userId, taskId)
    await deps.notify(audience)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, PATCH, DELETE' })
}

function notFound() {
  return json({ error: 'タスクが見つかりません。' }, 404)
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers })
}
