import type { ReminderMessage, Task } from '@todo/domain'

export type TodoDatabase = D1Database

export async function listTasks(db: TodoDatabase, userId: string): Promise<Task[]> {
  const { results } = await db
    .prepare(
      `SELECT id, user_id AS userId, title, due_at AS dueAt, completed_at AS completedAt
       FROM tasks WHERE user_id = ? ORDER BY completed_at IS NOT NULL, due_at IS NULL, due_at, created_at DESC`,
    )
    .bind(userId)
    .all<Task>()

  return results
}

export async function createTask(
  db: TodoDatabase,
  input: { id: string; userId: string; title: string; dueAt: string | null },
): Promise<Task> {
  await db
    .prepare('INSERT INTO tasks (id, user_id, title, due_at) VALUES (?, ?, ?, ?)')
    .bind(input.id, input.userId, input.title, input.dueAt)
    .run()

  return {
    id: input.id,
    userId: input.userId,
    title: input.title,
    dueAt: input.dueAt,
    completedAt: null,
  }
}

export async function setTaskCompleted(
  db: TodoDatabase,
  userId: string,
  taskId: string,
  completed: boolean,
) {
  await db
    .prepare('UPDATE tasks SET completed_at = ? WHERE id = ? AND user_id = ?')
    .bind(completed ? new Date().toISOString() : null, taskId, userId)
    .run()
}

export async function deleteTask(db: TodoDatabase, userId: string, taskId: string) {
  await db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(taskId, userId).run()
}

export async function ensureUser(db: TodoDatabase, userId: string, email: string) {
  await db
    .prepare('INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email')
    .bind(userId, email)
    .run()
}

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
