import type { Task } from '@todo/domain'

export interface TaskRepository {
  listByUser(userId: string): Promise<Task[]>
  create(task: Task): Promise<void>
  setCompleted(userId: string, taskId: string, completedAt: string | null): Promise<void>
  delete(userId: string, taskId: string): Promise<void>
}
