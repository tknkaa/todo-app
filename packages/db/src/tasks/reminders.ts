import { and, eq, gt, isNull, lte } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { ReminderMessage } from '@todo/domain'
import { tasks, users } from '../schema'
import type { TodoDatabase } from './repository'

export async function findDueReminders(
  database: TodoDatabase,
  now: string,
  until: string,
): Promise<ReminderMessage[]> {
  const reminders = await drizzle(database, { schema: { tasks, users } })
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
  await drizzle(database, { schema: { tasks, users } })
    .update(tasks)
    .set({ reminderQueuedAt: queuedAt })
    .where(and(eq(tasks.id, taskId), isNull(tasks.reminderQueuedAt)))
    .run()
}
