import { beforeEach, describe, expect, it } from 'vitest'
import { D1AttachmentRepository, D1TaskRepository } from '@todo/db'
import { createTestDatabase, insertUser } from '@todo/db/testing'
import { MAX_ATTACHMENT_BYTES } from '@/lib/attachment'
import {
  deleteTaskAttachments,
  handleAttachmentsRequest,
  type AttachmentDeps,
  type ObjectStore,
} from './handler'

function memoryStore() {
  const objects = new Map<string, ArrayBuffer>()
  const store: ObjectStore = {
    async put(key, body) {
      objects.set(key, body)
    },
    async get(key) {
      return objects.get(key) ?? null
    },
    async delete(keys) {
      for (const key of keys) objects.delete(key)
    },
  }
  return { objects, store }
}

describe('handleAttachmentsRequest', () => {
  let deps: AttachmentDeps
  let objects: Map<string, ArrayBuffer>
  let counter: number

  const upload = (taskId: string, file: File | null, userId = 'alice') => {
    const form = new FormData()
    if (file) form.set('file', file)
    return handleAttachmentsRequest(
      new Request(`http://localhost/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: form,
      }),
      deps,
      userId,
    )
  }
  const call = (method: string, path: string, userId = 'alice') =>
    handleAttachmentsRequest(new Request(`http://localhost${path}`, { method }), deps, userId)
  const text = (name: string, content = 'hello', type = 'text/plain') =>
    new File([content], name, { type })

  beforeEach(async () => {
    const database = createTestDatabase()
    const memory = memoryStore()
    objects = memory.objects
    counter = 0
    deps = {
      tasks: new D1TaskRepository(database),
      attachments: new D1AttachmentRepository(database),
      store: memory.store,
      newId: () => `att-${++counter}`,
    }
    await insertUser(database, 'alice')
    await insertUser(database, 'bob')
    await deps.tasks.create({
      id: 't1',
      userId: 'alice',
      title: 'one',
      dueAt: null,
      completedAt: null,
      remindBeforeMinutes: null,
    })
  })

  it('uploads a file, lists it and downloads it as an attachment', async () => {
    const created = await upload('t1', text('メモ.txt'))
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({
      id: 'att-1',
      filename: 'メモ.txt',
      contentType: 'text/plain',
      size: 5,
    })
    expect(objects.has('alice/t1/att-1')).toBe(true)

    const listed = await call('GET', '/api/tasks/t1/attachments')
    expect(((await listed.json()) as { id: string }[]).map((a) => a.id)).toEqual(['att-1'])

    const download = await call('GET', '/api/attachments/att-1')
    expect(download.status).toBe(200)
    expect(await download.text()).toBe('hello')
    expect(download.headers.get('content-disposition')).toMatch(/^attachment;/)
    expect(download.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('does not expose the storage key', async () => {
    const created = await upload('t1', text('a.txt'))
    expect(await created.json()).not.toHaveProperty('r2Key')
  })

  it('rejects a missing file, an oversized file and a sixth file', async () => {
    expect((await upload('t1', null)).status).toBe(400)

    const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.bin')
    expect((await upload('t1', big)).status).toBe(400)

    for (let i = 0; i < 5; i++) expect((await upload('t1', text(`f${i}.txt`))).status).toBe(201)
    const sixth = await upload('t1', text('f6.txt'))
    expect(sixth.status).toBe(400)
    expect(objects.size).toBe(5)
  })

  it('does not let another user list, upload, download or delete', async () => {
    await upload('t1', text('a.txt'))

    expect((await call('GET', '/api/tasks/t1/attachments', 'bob')).status).toBe(404)
    expect((await upload('t1', text('b.txt'), 'bob')).status).toBe(404)
    expect((await call('GET', '/api/attachments/att-1', 'bob')).status).toBe(404)
    expect((await call('DELETE', '/api/attachments/att-1', 'bob')).status).toBe(404)
    expect(objects.size).toBe(1)
  })

  it('deletes the file from the store and the database', async () => {
    await upload('t1', text('a.txt'))

    expect((await call('DELETE', '/api/attachments/att-1')).status).toBe(204)
    expect(objects.size).toBe(0)
    expect((await call('GET', '/api/attachments/att-1')).status).toBe(404)
  })

  it('removes all files of a task from the store', async () => {
    await upload('t1', text('a.txt'))
    await upload('t1', text('b.txt'))

    await deleteTaskAttachments(deps, 'bob', 't1')
    expect(objects.size).toBe(2)

    await deleteTaskAttachments(deps, 'alice', 't1')
    expect(objects.size).toBe(0)
  })

  it('answers unknown routes and methods', async () => {
    expect((await call('PUT', '/api/tasks/t1/attachments')).status).toBe(405)
    expect((await call('PUT', '/api/attachments/att-x')).status).toBe(404)
    expect((await call('GET', '/api/other')).status).toBe(404)
  })
})
