import { and, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { ReminderMessage } from '../types'
import { tasks, users } from '../schema'
import type { TodoDatabase } from './repository'

/**
 * Open tasks that asked for a reminder, whose reminder time (deadline minus the chosen
 * lead time) has passed, whose deadline is still ahead, and that were not queued yet.
 */
export async function findDueReminders(
  database: TodoDatabase,
  now: string,
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
        isNotNull(tasks.remindBeforeMinutes),
        gt(tasks.dueAt, now),
        sql`cast(strftime('%s', ${tasks.dueAt}) as integer) - ${tasks.remindBeforeMinutes} * 60 <= cast(strftime('%s', ${now}) as integer)`,
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
