import { describe, expect, it, vi } from 'vitest'
import type { NotificationMessage } from '@todo/db'
import { createMailSender } from './mail-queue'

const message: NotificationMessage = {
  type: 'task-shared',
  to: 'bob@example.com',
  sharedBy: 'alice@example.com',
  taskId: 't1',
  taskTitle: 'one',
  registered: true,
}

describe('createMailSender', () => {
  it('sends the message to the queue', async () => {
    const send = vi.fn<(message: NotificationMessage) => Promise<void>>(async () => {})
    await createMailSender({ send } as unknown as Queue<NotificationMessage>)(message)
    expect(send).toHaveBeenCalledWith(message)
  })

  it('swallows a queue failure so the request still succeeds', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn<(message: NotificationMessage) => Promise<void>>(async () => {
      throw new Error('queue down')
    })

    await expect(
      createMailSender({ send } as unknown as Queue<NotificationMessage>)(message),
    ).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
