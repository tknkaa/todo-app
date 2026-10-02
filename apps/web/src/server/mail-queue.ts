import type { NotificationMessage } from '@todo/db'
import type { SendMail } from './tasks/handler'

/** Puts mails on the notification queue. A queue problem is logged and never fails the request. */
export function createMailSender(queue: Queue<NotificationMessage>): SendMail {
  return async (message) => {
    try {
      await queue.send(message)
    } catch (error) {
      console.error('could not queue a mail', error)
    }
  }
}
