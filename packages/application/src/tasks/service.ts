import * as v from 'valibot'
import type { Task } from '@todo/domain'
import type { TaskRepository } from './repository'
import { createTaskInputSchema, type CreateTaskInput } from './schema'

export class TaskInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskInputError'
  }
}

export function listTasks(repository: TaskRepository, userId: string) {
  return repository.listByUser(userId)
}

export async function createTask(
  repository: TaskRepository,
  input: CreateTaskInput,
): Promise<Task> {
  const parsed = v.safeParse(createTaskInputSchema, input)
  if (!parsed.success)
    throw new TaskInputError(parsed.issues[0]?.message ?? '入力を確認してください。')

  const task: Task = {
    ...parsed.output,
    completedAt: null,
  }
  await repository.create(task)
  return task
}

export async function setTaskCompleted(
  repository: TaskRepository,
  userId: string,
  taskId: string,
  completed: boolean,
  now: () => Date = () => new Date(),
) {
  await repository.setCompleted(userId, taskId, completed ? now().toISOString() : null)
}

export function deleteTask(repository: TaskRepository, userId: string, taskId: string) {
  return repository.delete(userId, taskId)
}
