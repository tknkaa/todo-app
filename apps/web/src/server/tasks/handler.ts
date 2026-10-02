import {
  createTask,
  deleteTask,
  listTasks,
  setTaskCompleted,
  TaskInputError,
  type TaskRepository,
} from '@todo/application'

export async function handleTasksRequest(
  request: Request,
  repository: TaskRepository,
  userId: string,
): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/tasks') {
    if (request.method === 'GET') {
      return json(await listTasks(repository, userId))
    }

    if (request.method === 'POST') {
      const body = await readJsonObject(request)
      if (!body) return json({ error: 'Invalid JSON body' }, 400)

      const title = typeof body.title === 'string' ? body.title : ''
      const dueAt = body.dueAt
      if (dueAt !== undefined && dueAt !== null && dueAt !== '' && typeof dueAt !== 'string') {
        return json({ error: '締め切りの日時が正しくありません。' }, 400)
      }

      try {
        const task = await createTask(repository, {
          id: crypto.randomUUID(),
          userId,
          title,
          dueAt: typeof dueAt === 'string' && dueAt ? dueAt : null,
        })
        return json(task, 201)
      } catch (error) {
        if (error instanceof TaskInputError) return json({ error: error.message }, 400)
        throw error
      }
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
    await setTaskCompleted(repository, userId, taskId, body.completed)
    return new Response(null, { status: 204 })
  }

  if (request.method === 'DELETE') {
    await deleteTask(repository, userId, taskId)
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
