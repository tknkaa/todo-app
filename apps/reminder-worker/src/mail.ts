import type { NotificationMessage, ReminderMessage } from '@todo/db'

export type Mail = { to: string; subject: string; text: string }

const TIME_ZONE = 'Asia/Tokyo'

function link(appUrl: string, path: string) {
  return `${appUrl.replace(/\/+$/, '')}${path}`
}

/** "2030年1月2日 9:00" in Japan time, which is what the app's users expect. */
export function formatDue(iso: string) {
  return `${new Intl.DateTimeFormat('ja-JP', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))} (日本時間)`
}

export function reminderMail(reminder: ReminderMessage, appUrl: string): Mail {
  return {
    to: reminder.email,
    subject: `締め切りが近いタスク: ${reminder.title}`,
    text: [
      `「${reminder.title}」の締め切りは ${formatDue(reminder.dueAt)} です。`,
      '',
      `開く: ${link(appUrl, `/tasks/${encodeURIComponent(reminder.taskId)}`)}`,
    ].join('\n'),
  }
}

export function taskSharedMail(message: NotificationMessage, appUrl: string): Mail {
  const subject = `${message.sharedBy} さんがタスクを共有しました: ${message.taskTitle}`
  if (message.registered) {
    return {
      to: message.to,
      subject,
      text: [
        `${message.sharedBy} さんが「${message.taskTitle}」を共有しました。`,
        '',
        `開く: ${link(appUrl, `/tasks/${encodeURIComponent(message.taskId)}`)}`,
      ].join('\n'),
    }
  }
  return {
    to: message.to,
    subject,
    text: [
      `${message.sharedBy} さんが「${message.taskTitle}」をあなたと共有しました。`,
      '',
      'このメールアドレスでアカウントを作成すると、タスクが表示されます。',
      `アカウントを作成: ${link(appUrl, '/login')}`,
    ].join('\n'),
  }
}

/** The request that sends a mail through Resend. */
export function resendRequest(mail: Mail, from: string, apiKey: string) {
  return {
    url: 'https://api.resend.com/emails',
    init: {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
    } satisfies RequestInit,
  }
}

/** Local development: nothing is sent there, so a missing Resend key is expected. */
export function isLocalApp(appUrl: string) {
  try {
    const { hostname } = new URL(appUrl)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}
