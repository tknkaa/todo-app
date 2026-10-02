import type { D1TaskMemberRepository, D1TaskRepository } from '@todo/db'
import { completionTimestamp, parseCreateTaskInput, parseUpdateTaskInput } from '@/lib/task-input'

/** Tells the given users that the tasks they can see have changed. */
export type Notify = (userIds: string[]) => Promise<void>

export interface TaskDeps {
  tasks: D1TaskRepository
  members: D1TaskMemberRepository
  notify: Notify
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

      const task = { id: crypto.randomUUID(), userId, completedAt: null, ...parsed.value }
      await deps.tasks.create(task)
      await deps.notify([userId])
      return json(task, 201)
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

  if (request.method === 'PATCH') {
    const body = await readJsonObject(request)
    if (!body) return json({ error: 'Invalid JSON body' }, 400)
    const parsed = parseUpdateTaskInput(body)
    if (!parsed.ok) return json({ error: parsed.message }, 400)
    if (!(await deps.tasks.findAccessible(userId, taskId))) return notFound()

    const { completed, ...fields } = parsed.value
    await deps.tasks.update(userId, taskId, fields)
    if (completed !== undefined) {
      await deps.tasks.setCompleted(userId, taskId, completionTimestamp(completed, now()))
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

  return json({ error: 'Method not allowed' }, 405, { Allow: 'PATCH, DELETE' })
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
