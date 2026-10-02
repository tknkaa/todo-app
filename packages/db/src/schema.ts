import { sql } from 'drizzle-orm'
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull(),
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    dueAt: text('due_at'),
    completedAt: text('completed_at'),
    reminderQueuedAt: text('reminder_queued_at'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('tasks_due_at_idx').on(table.dueAt, table.completedAt, table.reminderQueuedAt)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type TaskRecord = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
