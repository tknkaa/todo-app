import type { ReminderMessage } from '@todo/domain'

export type TodoDatabase = D1Database

export async function findDueReminders(
  db: TodoDatabase,
  now: string,
  until: string,
): Promise<ReminderMessage[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id AS taskId, t.user_id AS userId, u.email, t.title, t.due_at AS dueAt
       FROM tasks t JOIN users u ON u.id = t.user_id
       WHERE t.completed_at IS NULL AND t.due_at > ? AND t.due_at <= ?
         AND t.reminder_queued_at IS NULL`,
    )
    .bind(now, until)
    .all<ReminderMessage>()

  return results
}

export async function markReminderQueued(db: TodoDatabase, taskId: string, queuedAt: string) {
  await db
    .prepare('UPDATE tasks SET reminder_queued_at = ? WHERE id = ? AND reminder_queued_at IS NULL')
    .bind(queuedAt, taskId)
    .run()
}
