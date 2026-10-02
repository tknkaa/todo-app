import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import {
  D1AttachmentRepository,
  D1TaskMemberRepository,
  D1TaskRepository,
  type NotificationMessage,
} from '@todo/db'
import { getAuth } from './server/auth'
import { publicConfig } from './server/auth-config'
import {
  deleteTaskAttachments,
  handleAttachmentsRequest,
  objectStoreFromR2,
} from './server/attachments/handler'
import { connectLive, createNotifier } from './server/live'
import { createMailSender } from './server/mail-queue'
import { handleTasksRequest } from './server/tasks/handler'
import { handleMembersRequest } from './server/tasks/members-handler'
export { CollaborationRoom } from './durable-object'

const startHandler = createStartHandler(defaultStreamHandler)

interface Env {
  DB: D1Database
  FILES: R2Bucket
  COLLABORATION: DurableObjectNamespace
  NOTIFICATION_QUEUE: Queue<NotificationMessage>
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/config') {
      return Response.json(publicConfig(env))
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return getAuth(env).handler(request)
    }
    if (
      url.pathname.startsWith('/api/tasks') ||
      url.pathname.startsWith('/api/attachments') ||
      url.pathname === '/api/live'
    ) {
      return handleApi(request, env)
    }
    return startHandler(request)
  },
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const session = await getAuth(env).api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: 'ログインしてください。' }, { status: 401 })

  const userId = session.user.id
  if (new URL(request.url).pathname === '/api/live') {
    return connectLive(request, env.COLLABORATION, userId)
  }

  const tasks = new D1TaskRepository(env.DB)
  const taskDeps = {
    tasks,
    members: new D1TaskMemberRepository(env.DB),
    notify: createNotifier(env.COLLABORATION),
    sendMail: createMailSender(env.NOTIFICATION_QUEUE),
  }
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
  if (/^\/api\/tasks\/[^/]+\/members(\/[^/]+)?$/.test(pathname)) {
    return handleMembersRequest(request, taskDeps, userId)
  }

  return handleTasksRequest(request, taskDeps, userId)
}
