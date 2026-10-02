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

/** Splits tasks into board columns. Inside a column the order is by position; ties keep the incoming order. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
  for (const task of tasks) columns[task.status].push(task)
  for (const status of TASK_STATUSES) columns[status].sort((a, b) => a.position - b.position)
  return columns
}

/** Applies a move to a list locally, without waiting for the server. */
export function moveTask(
  tasks: Task[],
  taskId: string,
  status: TaskStatus,
  now: Date,
  position?: number,
): Task[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          ...statusChange(status, now),
          position: position ?? task.position,
          // Staying in the same column must not change when the task was finished.
          completedAt:
            status === task.status ? task.completedAt : statusChange(status, now).completedAt,
        }
      : task,
  )
}
