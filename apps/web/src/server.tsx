import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createTask, deleteTask, ensureUser, listTasks, setTaskCompleted } from '@todo/db'
import type { Task } from '@todo/domain'
export { CollaborationRoom } from './durable-object'

const startHandler = createStartHandler(defaultStreamHandler)

interface Env {
  DB: D1Database
  DEMO_USER_ID?: string
  DEMO_USER_EMAIL?: string
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/tasks')) {
      return handleTasks(request, env)
    }
    return startHandler(request)
  },
}

async function handleTasks(request: Request, env: Env): Promise<Response> {
  if (!env.DEMO_USER_ID || !env.DEMO_USER_EMAIL) {
    return json({ error: 'Set DEMO_USER_ID and DEMO_USER_EMAIL in the Worker environment.' }, 503)
  }

  await ensureUser(env.DB, env.DEMO_USER_ID, env.DEMO_USER_EMAIL)
  const url = new URL(request.url)

  if (url.pathname === '/api/tasks' && request.method === 'GET') {
    return json(await listTasks(env.DB, env.DEMO_USER_ID))
  }

  if (url.pathname === '/api/tasks' && request.method === 'POST') {
    let body: { title?: unknown; dueAt?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 200) {
      return json({ error: 'タイトルは1〜200文字で入力してください。' }, 400)
    }

    const dueAt = typeof body.dueAt === 'string' && body.dueAt ? new Date(body.dueAt) : null
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return json({ error: '締め切りの日時が正しくありません。' }, 400)
    }

    const task: Task = await createTask(env.DB, {
      id: crypto.randomUUID(),
      userId: env.DEMO_USER_ID,
      title,
      dueAt: dueAt?.toISOString() ?? null,
    })
    return json(task, 201)
  }

  const match = url.pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (!match) return json({ error: 'Not found' }, 404)
  const taskId = decodeURIComponent(match[1])

  if (request.method === 'PATCH') {
    let body: { completed?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    if (typeof body.completed !== 'boolean') {
      return json({ error: 'completed は boolean で指定してください。' }, 400)
    }
    await setTaskCompleted(env.DB, env.DEMO_USER_ID, taskId, body.completed)
    return new Response(null, { status: 204 })
  }

  if (request.method === 'DELETE') {
    await deleteTask(env.DB, env.DEMO_USER_ID, taskId)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, PATCH, DELETE' })
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers })
}
