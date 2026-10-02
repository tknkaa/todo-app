import { and, asc, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { ReminderMessage, Task } from '@todo/domain'
import { tasks, users } from './schema'

export type TodoDatabase = D1Database

export async function listTasks(database: TodoDatabase, userId: string): Promise<Task[]> {
  const db = drizzle(database, { schema: { tasks, users } })
  return db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      title: tasks.title,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(
      sql`case when ${tasks.completedAt} is not null then 1 else 0 end`,
      sql`case when ${tasks.dueAt} is null then 1 else 0 end`,
      asc(tasks.dueAt),
      desc(tasks.createdAt),
    )
}

export async function createTask(
  database: TodoDatabase,
  input: { id: string; userId: string; title: string; dueAt: string | null },
): Promise<Task> {
  const db = drizzle(database, { schema: { tasks, users } })
  await db.insert(tasks).values(input).run()

  return { ...input, completedAt: null }
}

export async function setTaskCompleted(
  database: TodoDatabase,
  userId: string,
  taskId: string,
  completed: boolean,
) {
  const db = drizzle(database, { schema: { tasks, users } })
  await db
    .update(tasks)
    .set({ completedAt: completed ? new Date().toISOString() : null })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .run()
}

export async function deleteTask(database: TodoDatabase, userId: string, taskId: string) {
  const db = drizzle(database, { schema: { tasks, users } })
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).run()
}

export async function ensureUser(database: TodoDatabase, userId: string, email: string) {
  const db = drizzle(database, { schema: { tasks, users } })
  await db
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoUpdate({ target: users.id, set: { email } })
    .run()
}

export async function findDueReminders(
  database: TodoDatabase,
  now: string,
  until: string,
): Promise<ReminderMessage[]> {
  const db = drizzle(database, { schema: { tasks, users } })
  const reminders = await db
    .select({
      taskId: tasks.id,
      userId: tasks.userId,
      email: users.email,
      title: tasks.title,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.userId, users.id))
    .where(
      and(
        isNull(tasks.completedAt),
        gt(tasks.dueAt, now),
        lte(tasks.dueAt, until),
        isNull(tasks.reminderQueuedAt),
      ),
    )

  return reminders.flatMap((reminder) =>
    reminder.dueAt ? [{ ...reminder, dueAt: reminder.dueAt }] : [],
  )
}

export async function markReminderQueued(database: TodoDatabase, taskId: string, queuedAt: string) {
  const db = drizzle(database, { schema: { tasks, users } })
  await db
    .update(tasks)
    .set({ reminderQueuedAt: queuedAt })
    .where(and(eq(tasks.id, taskId), isNull(tasks.reminderQueuedAt)))
    .run()
}
