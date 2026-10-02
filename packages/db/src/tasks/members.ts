import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { taskInvites, taskMembers, tasks, users } from '../schema'
import type { TodoDatabase } from './repository'

export class D1TaskMemberRepository {
  constructor(private readonly database: TodoDatabase) {}

  async emailOf(userId: string): Promise<string | null> {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
    return user?.email ?? null
  }

  /**
   * Emails a task is shared with: people with an account and people who were invited. They are
   * not told apart, so the list does not reveal which addresses have an account.
   */
  async listEmails(taskId: string): Promise<string[]> {
    const members = await this.db
      .select({ email: users.email, at: taskMembers.createdAt })
      .from(taskMembers)
      .innerJoin(users, eq(users.id, taskMembers.userId))
      .where(eq(taskMembers.taskId, taskId))
    const invites = await this.db
      .select({ email: taskInvites.email, at: taskInvites.createdAt })
      .from(taskInvites)
      .where(eq(taskInvites.taskId, taskId))
    return [...members, ...invites]
      .sort((a, b) => a.at.localeCompare(b.at) || a.email.localeCompare(b.email))
      .map((entry) => entry.email)
  }

  /**
   * Shares a task with an email address. Someone with an account becomes a member right away;
   * anyone else is invited and becomes a member when they sign up.
   * `added` is false when the address was already shared with.
   */
  async addByEmail(
    taskId: string,
    email: string,
  ): Promise<{ added: boolean; registered: boolean }> {
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (user) {
      const [existing] = await this.db
        .select({ one: taskMembers.taskId })
        .from(taskMembers)
        .where(and(eq(taskMembers.taskId, taskId), eq(taskMembers.userId, user.id)))
      if (existing) return { added: false, registered: true }
      await this.db.insert(taskMembers).values({ taskId, userId: user.id }).run()
      return { added: true, registered: true }
    }

    const [invited] = await this.db
      .select({ one: taskInvites.taskId })
      .from(taskInvites)
      .where(and(eq(taskInvites.taskId, taskId), eq(taskInvites.email, email)))
    if (invited) return { added: false, registered: false }
    await this.db.insert(taskInvites).values({ taskId, email }).run()
    return { added: true, registered: false }
  }

  /** Stops sharing with an email address, whether they are a member or only invited. */
  async removeByEmail(taskId: string, email: string) {
    await this.db
      .delete(taskInvites)
      .where(and(eq(taskInvites.taskId, taskId), eq(taskInvites.email, email)))
      .run()
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (user) {
      await this.db
        .delete(taskMembers)
        .where(and(eq(taskMembers.taskId, taskId), eq(taskMembers.userId, user.id)))
        .run()
    }
  }

  /** Turns the invitations sent to a new account's email into memberships. */
  async acceptInvites(userId: string, email: string): Promise<number> {
    const invites = await this.db
      .select({ taskId: taskInvites.taskId })
      .from(taskInvites)
      .where(eq(taskInvites.email, email))
    for (const invite of invites) {
      await this.db
        .insert(taskMembers)
        .values({ taskId: invite.taskId, userId })
        .onConflictDoNothing()
        .run()
    }
    if (invites.length > 0) {
      await this.db.delete(taskInvites).where(eq(taskInvites.email, email)).run()
    }
    return invites.length
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
    return drizzle(this.database, { schema: { taskInvites, taskMembers, tasks, users } })
  }
}
