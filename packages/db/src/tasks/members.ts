import { and, asc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { taskMembers, tasks, users } from '../schema'
import type { TaskMember } from '../types'
import type { TodoDatabase } from './repository'

export class D1TaskMemberRepository {
  constructor(private readonly database: TodoDatabase) {}

  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    return user ?? null
  }

  listByTask(taskId: string): Promise<TaskMember[]> {
    return this.db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(taskMembers)
      .innerJoin(users, eq(users.id, taskMembers.userId))
      .where(eq(taskMembers.taskId, taskId))
      .orderBy(asc(taskMembers.createdAt), asc(users.email))
  }

  async add(taskId: string, userId: string) {
    await this.db.insert(taskMembers).values({ taskId, userId }).onConflictDoNothing().run()
  }

  async remove(taskId: string, userId: string) {
    await this.db
      .delete(taskMembers)
      .where(and(eq(taskMembers.taskId, taskId), eq(taskMembers.userId, userId)))
      .run()
  }

  /** The owner and every member of a task: the people who should hear about a change. */
  async accessUserIds(taskId: string): Promise<string[]> {
    const [owner] = await this.db
      .select({ id: tasks.userId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
    if (!owner) return []
    const members = await this.db
      .select({ id: taskMembers.userId })
      .from(taskMembers)
      .where(eq(taskMembers.taskId, taskId))
    return [owner.id, ...members.map((member) => member.id)]
  }

  private get db() {
    return drizzle(this.database, { schema: { taskMembers, tasks, users } })
  }
}
