import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { D1TaskRepository } from '@todo/db'
import { getAuth } from './server/auth'
import { handleTasksRequest } from './server/tasks/handler'
export { CollaborationRoom } from './durable-object'

const startHandler = createStartHandler(defaultStreamHandler)

interface Env {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/auth/')) {
      return getAuth(env).handler(request)
    }
    if (url.pathname.startsWith('/api/tasks')) {
      return handleTasks(request, env)
    }
    return startHandler(request)
  },
}

async function handleTasks(request: Request, env: Env): Promise<Response> {
  const session = await getAuth(env).api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: 'ログインしてください。' }, { status: 401 })

  return handleTasksRequest(request, new D1TaskRepository(env.DB), session.user.id)
}
