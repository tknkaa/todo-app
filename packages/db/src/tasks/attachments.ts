import { and, asc, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { attachments } from '../schema'
import type { Attachment } from '../types'
import type { TodoDatabase } from './repository'

export class D1AttachmentRepository {
  constructor(private readonly database: TodoDatabase) {}

  listByTask(userId: string, taskId: string): Promise<Attachment[]> {
    return this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.userId, userId), eq(attachments.taskId, taskId)))
      .orderBy(asc(attachments.createdAt), asc(attachments.id))
  }

  async countByTask(userId: string, taskId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(attachments)
      .where(and(eq(attachments.userId, userId), eq(attachments.taskId, taskId)))
    return row?.count ?? 0
  }

  async find(userId: string, id: string): Promise<Attachment | null> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.userId, userId), eq(attachments.id, id)))
    return row ?? null
  }

  async create(attachment: Omit<Attachment, 'createdAt'>) {
    await this.db.insert(attachments).values(attachment).run()
  }

  async delete(userId: string, id: string) {
    await this.db
      .delete(attachments)
      .where(and(eq(attachments.userId, userId), eq(attachments.id, id)))
      .run()
  }

  private get db() {
    return drizzle(this.database, { schema: { attachments } })
  }
}
