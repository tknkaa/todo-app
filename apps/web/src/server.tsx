import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { D1AttachmentRepository, D1TaskRepository } from '@todo/db'
import { getAuth } from './server/auth'
import {
  deleteTaskAttachments,
  handleAttachmentsRequest,
  objectStoreFromR2,
} from './server/attachments/handler'
import { handleTasksRequest } from './server/tasks/handler'
export { CollaborationRoom } from './durable-object'

const startHandler = createStartHandler(defaultStreamHandler)

interface Env {
  DB: D1Database
  FILES: R2Bucket
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/auth/')) {
      return getAuth(env).handler(request)
    }
    if (url.pathname.startsWith('/api/tasks') || url.pathname.startsWith('/api/attachments')) {
      return handleApi(request, env)
    }
    return startHandler(request)
  },
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const session = await getAuth(env).api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: 'ログインしてください。' }, { status: 401 })

  const userId = session.user.id
  const tasks = new D1TaskRepository(env.DB)
  const attachmentDeps = {
    tasks,
    attachments: new D1AttachmentRepository(env.DB),
    store: objectStoreFromR2(env.FILES),
  }
  const { pathname } = new URL(request.url)

  if (
    pathname.startsWith('/api/attachments') ||
    /^\/api\/tasks\/[^/]+\/attachments$/.test(pathname)
  ) {
    return handleAttachmentsRequest(request, attachmentDeps, userId)
  }

  const taskPath = pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (request.method === 'DELETE' && taskPath) {
    try {
      await deleteTaskAttachments(attachmentDeps, userId, decodeURIComponent(taskPath[1]))
    } catch {
      // The task handler below reports invalid ids.
    }
  }
  return handleTasksRequest(request, tasks, userId)
}
