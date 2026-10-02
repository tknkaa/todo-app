import { describe, expect, it } from 'vitest'
import {
  attachmentDisposition,
  attachmentKey,
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TASK,
  validateAttachment,
} from './attachment'

describe('validateAttachment', () => {
  it('accepts a file within the limits', () => {
    expect(validateAttachment({ name: 'a.txt', size: 10 }, 0)).toEqual({ ok: true })
    expect(validateAttachment({ name: 'a.txt', size: MAX_ATTACHMENT_BYTES }, 0).ok).toBe(true)
    expect(validateAttachment({ name: 'a.txt', size: 10 }, MAX_ATTACHMENTS_PER_TASK - 1).ok).toBe(
      true,
    )
  })

  it.each([
    [{ name: 'a.txt', size: 0 }, 0, '空のファイルは添付できません。'],
    [{ name: 'a.txt', size: MAX_ATTACHMENT_BYTES + 1 }, 0, 'ファイルは 5 MB 以下にしてください。'],
    [{ name: '  ', size: 10 }, 0, 'ファイル名が正しくありません。'],
    [
      { name: 'a.txt', size: 10 },
      MAX_ATTACHMENTS_PER_TASK,
      '添付は 1 つのタスクにつき 5 件までです。',
    ],
  ])('rejects %j (existing %i)', (file, count, message) => {
    expect(validateAttachment(file, count)).toEqual({ ok: false, message })
  })
})

describe('attachmentKey', () => {
  it('scopes the key by user and task', () => {
    expect(attachmentKey('u1', 't1', 'a1')).toBe('u1/t1/a1')
  })
})

describe('attachmentDisposition', () => {
  it('forces a download and keeps ASCII names as they are', () => {
    expect(attachmentDisposition('report.pdf')).toBe(
      `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
    )
  })

  it('encodes non-ASCII names and neutralizes quotes', () => {
    const value = attachmentDisposition('報告"書.pdf')
    expect(value).toContain('filename="____.pdf"')
    expect(value).toContain(`filename*=UTF-8''${encodeURIComponent('報告"書.pdf')}`)
    expect(value.split('"')).toHaveLength(3)
  })
})

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats %i as %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text)
  })
})
