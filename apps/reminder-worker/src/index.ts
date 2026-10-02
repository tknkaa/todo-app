import { findDueReminders, markReminderQueued, type ReminderMessage } from '@todo/db'

interface Env {
  DB: D1Database
  REMINDER_QUEUE: Queue<ReminderMessage>
  RESEND_API_KEY: string
  REMINDER_FROM: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(queueDueReminders(env))
  },

  async queue(batch: MessageBatch<ReminderMessage>, env: Env) {
    for (const message of batch.messages) {
      await sendReminder(message.body, env)
      message.ack()
    }
  },
}

async function queueDueReminders(env: Env) {
  const now = new Date()
  const reminders = await findDueReminders(env.DB, now.toISOString())

  for (const reminder of reminders) {
    await env.REMINDER_QUEUE.send(reminder)
    await markReminderQueued(env.DB, reminder.taskId, now.toISOString())
  }
}

async function sendReminder(reminder: ReminderMessage, env: Env) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.REMINDER_FROM,
      to: reminder.email,
      subject: `締め切りが近いタスク: ${reminder.title}`,
      text: `「${reminder.title}」の締め切りは ${reminder.dueAt} です。`,
    }),
  })

  if (!response.ok) throw new Error(`Resend request failed: ${response.status}`)
}
