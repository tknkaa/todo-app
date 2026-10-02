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
