export type TaskStatus = 'todo' | 'doing' | 'done'

export type Task = {
  id: string
  userId: string
  title: string
  /** Board column. `done` goes together with `completedAt` being set. */
  status: TaskStatus
  /** Order inside the board column. Smaller comes first. */
  position: number
  dueAt: string | null
  completedAt: string | null
  /** Minutes before the deadline to send a reminder. null means no reminder. */
  remindBeforeMinutes: number | null
}

/** A task with its body text, which the board does not need and so does not load. */
export type TaskDetail = Task & { description: string; descriptionVersion: number }

export type ReminderMessage = {
  taskId: string
  userId: string
  email: string
  title: string
  dueAt: string
}

export type Attachment = {
  id: string
  taskId: string
  userId: string
  filename: string
  contentType: string
  size: number
  r2Key: string
  createdAt: string
}

/** Mail to send, queued by the web app and sent by the worker. */
export type NotificationMessage = {
  type: 'task-shared'
  to: string
  sharedBy: string
  taskId: string
  taskTitle: string
  /** Whether `to` already has an account. Only the mail text depends on it. */
  registered: boolean
}
