import { describe, expect, it } from 'vitest'
import { formatDue, reminderMail, resendRequest, taskSharedMail } from './mail'

const app = 'https://todo.example.com/'

describe('formatDue', () => {
  it('shows Japan time', () => {
    expect(formatDue('2030-01-02T00:00:00.000Z')).toBe('2030年1月2日 9:00 (日本時間)')
  })
})

describe('reminderMail', () => {
  const mail = reminderMail(
    {
      taskId: 't 1',
      userId: 'u',
      email: 'alice@example.com',
      title: '企画書を出す',
      dueAt: '2030-01-02T00:00:00.000Z',
    },
    app,
  )

  it('is addressed to the owner with the title in the subject', () => {
    expect(mail.to).toBe('alice@example.com')
    expect(mail.subject).toBe('締め切りが近いタスク: 企画書を出す')
  })

  it('tells the deadline and links to the task page', () => {
    expect(mail.text).toContain('「企画書を出す」の締め切りは 2030年1月2日 9:00 (日本時間) です。')
    expect(mail.text).toContain('https://todo.example.com/tasks/t%201')
  })
})

describe('taskSharedMail', () => {
  const message = {
    type: 'task-shared' as const,
    to: 'bob@example.com',
    sharedBy: 'alice@example.com',
    taskId: 't1',
    taskTitle: '買い物',
    registered: true,
  }

  it('links a person with an account to the task', () => {
    const mail = taskSharedMail(message, app)
    expect(mail.to).toBe('bob@example.com')
    expect(mail.subject).toBe('alice@example.com さんがタスクを共有しました: 買い物')
    expect(mail.text).toContain('https://todo.example.com/tasks/t1')
    expect(mail.text).not.toContain('アカウントを作成')
  })

  it('asks a person without an account to sign up, and does not link the task', () => {
    const mail = taskSharedMail({ ...message, registered: false }, app)
    expect(mail.text).toContain('アカウントを作成')
    expect(mail.text).toContain('https://todo.example.com/login')
    expect(mail.text).not.toContain('/tasks/')
  })
})

describe('resendRequest', () => {
  it('posts the mail to Resend with the API key', () => {
    const { url, init } = resendRequest(
      { to: 'a@example.com', subject: 's', text: 't' },
      'Todo <noreply@example.com>',
      'key',
    )
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer key' })
    expect(JSON.parse(init.body)).toEqual({
      from: 'Todo <noreply@example.com>',
      to: 'a@example.com',
      subject: 's',
      text: 't',
    })
  })
})
