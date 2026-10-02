import type { D1TaskRepository } from '@todo/db'
import { completionTimestamp, parseCreateTaskInput } from '@/lib/task-input'

export async function handleTasksRequest(
  request: Request,
  repository: D1TaskRepository,
  userId: string,
  now: () => Date = () => new Date(),
): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/tasks') {
    if (request.method === 'GET') {
      return json(await repository.listByUser(userId))
    }

    if (request.method === 'POST') {
      const body = await readJsonObject(request)
      if (!body) return json({ error: 'Invalid JSON body' }, 400)

      const parsed = parseCreateTaskInput(body)
      if (!parsed.ok) return json({ error: parsed.message }, 400)

      const task = { id: crypto.randomUUID(), userId, completedAt: null, ...parsed.value }
      await repository.create(task)
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
    if (typeof body.completed !== 'boolean') {
      return json({ error: 'completed は boolean で指定してください。' }, 400)
    }
    await repository.setCompleted(userId, taskId, completionTimestamp(body.completed, now()))
    return new Response(null, { status: 204 })
  }

  if (request.method === 'DELETE') {
    await repository.delete(userId, taskId)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed' }, 405, { Allow: 'PATCH, DELETE' })
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
