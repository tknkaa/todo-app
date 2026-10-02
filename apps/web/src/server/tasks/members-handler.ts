import { parseShareInput } from '@/lib/share-input'
import type { TaskDeps } from './handler'

/**
 * Sharing a task by email: GET/POST /api/tasks/:id/members and
 * DELETE /api/tasks/:id/members/:email.
 *
 * The answers never say whether an address has an account, so the API cannot be used to find out
 * who is registered. Sharing with an address that has no account invites it instead.
 */
export async function handleMembersRequest(
  request: Request,
  deps: TaskDeps,
  userId: string,
): Promise<Response> {
  const { pathname } = new URL(request.url)
  const match = pathname.match(/^\/api\/tasks\/([^/]+)\/members(?:\/([^/]+))?$/)
  if (!match) return json({ error: 'Not found' }, 404)

  const taskId = decode(match[1])
  const target = match[2] === undefined ? undefined : decode(match[2])
  if (taskId === null || target === null) return json({ error: 'Invalid id' }, 400)

  const task = await deps.tasks.findAccessible(userId, taskId)
  if (!task) return json({ error: 'タスクが見つかりません。' }, 404)
  const isOwner = task.userId === userId
  const selfEmail = await deps.members.emailOf(userId)

  if (target === undefined) {
    if (request.method === 'GET') return json(await sharedWith(deps, taskId))

    if (request.method === 'POST') {
      if (!isOwner) return json({ error: '共有できるのはタスクの所有者だけです。' }, 403)
      const body = await request.json().catch(() => null)
      const parsed = parseShareInput(body)
      if (!parsed.ok) return json({ error: parsed.message }, 400)
      if (parsed.email === selfEmail) return json({ error: '自分自身とは共有できません。' }, 400)

      const result = await deps.members.addByEmail(taskId, parsed.email)
      if (result.added) {
        await deps.sendMail?.({
          type: 'task-shared',
          to: parsed.email,
          sharedBy: selfEmail ?? '',
          taskId,
          taskTitle: task.title,
          registered: result.registered,
        })
        await deps.notify(await deps.members.accessUserIds(taskId))
      }
      return json(await sharedWith(deps, taskId), 201)
    }

    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
  }

  if (request.method === 'DELETE') {
    const email = target.trim().toLowerCase()
    if (!isOwner && email !== selfEmail) {
      return json({ error: '共有を解除できるのは所有者か本人だけです。' }, 403)
    }
    const audience = await deps.members.accessUserIds(taskId)
    await deps.members.removeByEmail(taskId, email)
    await deps.notify(audience)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed' }, 405, { Allow: 'DELETE' })
}

async function sharedWith(deps: TaskDeps, taskId: string) {
  return (await deps.members.listEmails(taskId)).map((email) => ({ email }))
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
