import {
  findDueReminders,
  markReminderQueued,
  type NotificationMessage,
  type ReminderMessage,
} from '@todo/db'
import { isLocalApp, reminderMail, resendRequest, taskSharedMail, type Mail } from './mail'

interface Env {
  DB: D1Database
  REMINDER_QUEUE: Queue<ReminderMessage>
  /** Secret. Only local development may go without it (mails are then just logged). */
  RESEND_API_KEY?: string
  REMINDER_FROM: string
  APP_URL: string
}

const NOTIFICATION_QUEUE = 'todo-notifications'
const RETRY_DELAY_SECONDS = 60

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(queueDueReminders(env))
  },

  /** Reminders and share notifications arrive on two queues. A failed mail is retried on its own. */
  async queue(batch: MessageBatch<ReminderMessage | NotificationMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        const mail =
          batch.queue === NOTIFICATION_QUEUE
            ? taskSharedMail(message.body as NotificationMessage, env.APP_URL)
            : reminderMail(message.body as ReminderMessage, env.APP_URL)
        await sendMail(env, mail)
        message.ack()
      } catch (error) {
        console.error(`mail failed (attempt ${message.attempts})`, error)
        message.retry({ delaySeconds: RETRY_DELAY_SECONDS })
      }
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

async function sendMail(env: Env, mail: Mail) {
  if (!env.RESEND_API_KEY) {
    // Quietly skipping in production would lose the mail and still count it as sent.
    if (!isLocalApp(env.APP_URL)) throw new Error('RESEND_API_KEY is not set')
    console.log(`[mail not sent: RESEND_API_KEY is not set] to=${mail.to} subject=${mail.subject}`)
    return
  }
  const { url, init } = resendRequest(mail, env.REMINDER_FROM, env.RESEND_API_KEY)
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(
      `Resend request failed: ${response.status} ${(await response.text()).slice(0, 200)}`,
    )
  }
}
