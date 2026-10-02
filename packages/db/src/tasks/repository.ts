import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Task } from '../types'
import { tasks, users } from '../schema'

export type TodoDatabase = D1Database

export class D1TaskRepository {
  constructor(private readonly database: TodoDatabase) {}

  async listByUser(userId: string): Promise<Task[]> {
    return this.db
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

  async create(task: Task) {
    await this.db.insert(tasks).values(task).run()
  }

  async setCompleted(userId: string, taskId: string, completedAt: string | null) {
    await this.db
      .update(tasks)
      .set({ completedAt })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .run()
  }

  async delete(userId: string, taskId: string) {
    await this.db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .run()
  }

  private get db() {
    return drizzle(this.database, { schema: { tasks, users } })
  }
}
