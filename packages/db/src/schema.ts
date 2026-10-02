import { sql } from 'drizzle-orm'
import { customType, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const authTimestamp = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => new Date(value),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: authTimestamp('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: authTimestamp('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
})

export const authSessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey().notNull(),
    expiresAt: authTimestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: authTimestamp('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: authTimestamp('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
)

export const authAccounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey().notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: authTimestamp('access_token_expires_at'),
    refreshTokenExpiresAt: authTimestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: authTimestamp('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: authTimestamp('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)],
)

export const authVerifications = sqliteTable(
  'verifications',
  {
    id: text('id').primaryKey().notNull(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: authTimestamp('expires_at').notNull(),
    createdAt: authTimestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: authTimestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
)

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    status: text('status', { enum: ['todo', 'doing', 'done'] })
      .notNull()
      .default('todo'),
    dueAt: text('due_at'),
    completedAt: text('completed_at'),
    remindBeforeMinutes: integer('remind_before_minutes'),
    reminderQueuedAt: text('reminder_queued_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('tasks_due_at_idx').on(table.dueAt, table.completedAt, table.reminderQueuedAt)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type TaskRecord = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey().notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    r2Key: text('r2_key').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('attachments_task_id_idx').on(table.taskId)],
)

export const taskMembers = sqliteTable(
  'task_members',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index('task_members_user_id_idx').on(table.userId),
  ],
)

/** A share offered to an email address that has no account yet. It becomes a membership on sign-up. */
export const taskInvites = sqliteTable(
  'task_invites',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.email] }),
    index('task_invites_email_idx').on(table.email),
  ],
)
