export type Task = {
  id: string
  userId: string
  title: string
  dueAt: string | null
  completedAt: string | null
}

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

export type TaskMember = {
  userId: string
  email: string
  name: string
}
