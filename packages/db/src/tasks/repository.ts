import { and, asc, desc, eq, exists, or, sql, type SQL } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Task, TaskStatus } from '../types'
import { taskMembers, tasks, users } from '../schema'

export type TodoDatabase = D1Database

export class D1TaskRepository {
  constructor(private readonly database: TodoDatabase) {}

  async listByUser(userId: string): Promise<Task[]> {
    return this.db
      .select({
        id: tasks.id,
        userId: tasks.userId,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        remindBeforeMinutes: tasks.remindBeforeMinutes,
      })
      .from(tasks)
      .where(this.accessible(userId))
      .orderBy(
        sql`case when ${tasks.completedAt} is not null then 1 else 0 end`,
        sql`case when ${tasks.dueAt} is null then 1 else 0 end`,
        asc(tasks.dueAt),
        desc(tasks.createdAt),
      )
  }

  async findOwned(userId: string, taskId: string): Promise<Task | null> {
    const [task] = await this.db
      .select({
        id: tasks.id,
        userId: tasks.userId,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        remindBeforeMinutes: tasks.remindBeforeMinutes,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    return task ?? null
  }

  /** The task if the user owns it or it is shared with them. */
  async findAccessible(userId: string, taskId: string): Promise<Task | null> {
    const [task] = await this.db
      .select({
        id: tasks.id,
        userId: tasks.userId,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        remindBeforeMinutes: tasks.remindBeforeMinutes,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), this.accessible(userId)))
    return task ?? null
  }

  /**
   * Changes only the given fields, so concurrent edits of different fields both survive.
   * Changing the deadline or the reminder makes the task eligible for a new reminder.
   */
  async update(
    userId: string,
    taskId: string,
    changes: { title?: string; dueAt?: string | null; remindBeforeMinutes?: number | null },
  ) {
    if (Object.values(changes).every((value) => value === undefined)) return
    const reschedules = changes.dueAt !== undefined || changes.remindBeforeMinutes !== undefined
    await this.db
      .update(tasks)
      .set(reschedules ? { ...changes, reminderQueuedAt: null } : changes)
      .where(and(eq(tasks.id, taskId), this.accessible(userId)))
      .run()
  }

  async create(task: Task) {
    await this.db.insert(tasks).values(task).run()
  }

  async setStatus(userId: string, taskId: string, status: TaskStatus, completedAt: string | null) {
    await this.db
      .update(tasks)
      .set({ status, completedAt })
      .where(and(eq(tasks.id, taskId), this.accessible(userId)))
      .run()
  }

  async delete(userId: string, taskId: string) {
    await this.db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .run()
  }

  private accessible(userId: string): SQL {
    return or(
      eq(tasks.userId, userId),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(taskMembers)
          .where(and(eq(taskMembers.taskId, tasks.id), eq(taskMembers.userId, userId))),
      ),
    ) as SQL
  }

  private get db() {
    return drizzle(this.database, { schema: { tasks, users, taskMembers } })
  }
}
