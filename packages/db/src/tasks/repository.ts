import { and, asc, desc, eq, exists, or, sql, type SQL } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Task, TaskDetail, TaskStatus } from '../types'
import { taskMembers, tasks, users } from '../schema'

export type TodoDatabase = D1Database

const taskColumns = {
  id: tasks.id,
  userId: tasks.userId,
  title: tasks.title,
  status: tasks.status,
  position: tasks.position,
  dueAt: tasks.dueAt,
  completedAt: tasks.completedAt,
  remindBeforeMinutes: tasks.remindBeforeMinutes,
}

export class D1TaskRepository {
  constructor(private readonly database: TodoDatabase) {}

  async listByUser(userId: string): Promise<Task[]> {
    return this.db
      .select(taskColumns)
      .from(tasks)
      .where(this.accessible(userId))
      .orderBy(asc(tasks.position), desc(tasks.createdAt))
  }

  async findOwned(userId: string, taskId: string): Promise<Task | null> {
    const [task] = await this.db
      .select(taskColumns)
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    return task ?? null
  }

  /** The task if the user owns it or it is shared with them. */
  async findAccessible(userId: string, taskId: string): Promise<Task | null> {
    const [task] = await this.db
      .select(taskColumns)
      .from(tasks)
      .where(and(eq(tasks.id, taskId), this.accessible(userId)))
    return task ?? null
  }

  /** The task with its body text. */
  async findAccessibleDetail(userId: string, taskId: string): Promise<TaskDetail | null> {
    const [task] = await this.db
      .select({
        ...taskColumns,
        description: tasks.description,
        descriptionVersion: tasks.descriptionVersion,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), this.accessible(userId)))
    return task ?? null
  }

  /**
   * Saves the body text if `expectedVersion` is still the current one. Returns the new version,
   * or null when someone else saved first (or the user cannot edit the task).
   */
  async updateDescription(
    userId: string,
    taskId: string,
    description: string,
    expectedVersion: number,
  ): Promise<number | null> {
    const [saved] = await this.db
      .update(tasks)
      .set({ description, descriptionVersion: sql`${tasks.descriptionVersion} + 1` })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.descriptionVersion, expectedVersion),
          this.accessible(userId),
        ),
      )
      .returning({ version: tasks.descriptionVersion })
    return saved?.version ?? null
  }

  /**
   * Changes only the given fields, so concurrent edits of different fields both survive.
   * Changing the deadline or the reminder makes the task eligible for a new reminder.
   */
  async update(
    userId: string,
    taskId: string,
    changes: {
      title?: string
      dueAt?: string | null
      remindBeforeMinutes?: number | null
      position?: number
    },
  ) {
    if (Object.values(changes).every((value) => value === undefined)) return
    const reschedules = changes.dueAt !== undefined || changes.remindBeforeMinutes !== undefined
    await this.db
      .update(tasks)
      .set(reschedules ? { ...changes, reminderQueuedAt: null } : changes)
      .where(and(eq(tasks.id, taskId), this.accessible(userId)))
      .run()
  }

  /** Adds a task at the top of the to-do column and returns it. */
  async create(task: Omit<Task, 'position'>): Promise<Task> {
    await this.db
      .insert(tasks)
      .values({
        ...task,
        position: sql`(select coalesce(min(position), 0) - 1 from tasks where user_id = ${task.userId} and status = 'todo')`,
      })
      .run()
    const created = await this.findOwned(task.userId, task.id)
    if (!created) throw new Error('The task was not saved')
    return created
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
