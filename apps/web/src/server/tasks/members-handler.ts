import { parseShareInput } from '@/lib/share-input'
import type { TaskDeps } from './handler'

/** Sharing a task: GET/POST /api/tasks/:id/members and DELETE /api/tasks/:id/members/:userId. */
export async function handleMembersRequest(
  request: Request,
  deps: TaskDeps,
  userId: string,
): Promise<Response> {
  const { pathname } = new URL(request.url)
  const match = pathname.match(/^\/api\/tasks\/([^/]+)\/members(?:\/([^/]+))?$/)
  if (!match) return json({ error: 'Not found' }, 404)

  const taskId = decode(match[1])
  const memberId = match[2] === undefined ? undefined : decode(match[2])
  if (taskId === null || memberId === null) return json({ error: 'Invalid id' }, 400)

  const task = await deps.tasks.findAccessible(userId, taskId)
  if (!task) return json({ error: 'タスクが見つかりません。' }, 404)
  const isOwner = task.userId === userId

  if (memberId === undefined) {
    if (request.method === 'GET') return json(await deps.members.listByTask(taskId))

    if (request.method === 'POST') {
      if (!isOwner) return json({ error: '共有できるのはタスクの所有者だけです。' }, 403)
      const body = await request.json().catch(() => null)
      const parsed = parseShareInput(body)
      if (!parsed.ok) return json({ error: parsed.message }, 400)

      const target = await deps.members.findUserByEmail(parsed.email)
      if (!target) return json({ error: 'そのメールアドレスのユーザーは登録されていません。' }, 404)
      if (target.id === userId) return json({ error: '自分自身とは共有できません。' }, 400)

      await deps.members.add(taskId, target.id)
      await deps.notify(await deps.members.accessUserIds(taskId))
      return json(await deps.members.listByTask(taskId), 201)
    }

    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
  }

  if (request.method === 'DELETE') {
    if (!isOwner && memberId !== userId) {
      return json({ error: '共有を解除できるのは所有者か本人だけです。' }, 403)
    }
    const audience = await deps.members.accessUserIds(taskId)
    await deps.members.remove(taskId, memberId)
    await deps.notify(audience)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed' }, 405, { Allow: 'DELETE' })
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
