import type { Task, TaskStatus } from '@todo/db'

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const satisfies readonly TaskStatus[]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.some((status) => status === value)
}

/** A task is done exactly when it sits in the `done` column, and then it has a completion time. */
export function statusChange(status: TaskStatus, now: Date) {
  return { status, completedAt: status === 'done' ? now.toISOString() : null }
}

/** Splits tasks into board columns, keeping the order they came in. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
  for (const task of tasks) columns[task.status].push(task)
  return columns
}

/** Applies a move to a list locally, without waiting for the server. */
export function moveTask(tasks: Task[], taskId: string, status: TaskStatus, now: Date): Task[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, ...statusChange(status, now) } : task,
  )
}
