export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_TASK = 5

export type AttachmentCheck = { ok: true } | { ok: false; message: string }

/** Checks a file against the size and per-task count limits. */
export function validateAttachment(
  file: { name: string; size: number },
  existingCount: number,
): AttachmentCheck {
  if (file.name.trim() === '') return { ok: false, message: 'ファイル名が正しくありません。' }
  if (file.size === 0) return { ok: false, message: '空のファイルは添付できません。' }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, message: 'ファイルは 5 MB 以下にしてください。' }
  }
  if (existingCount >= MAX_ATTACHMENTS_PER_TASK) {
    return {
      ok: false,
      message: `添付は 1 つのタスクにつき ${MAX_ATTACHMENTS_PER_TASK} 件までです。`,
    }
  }
  return { ok: true }
}

/** Object key in R2. Scoped by user and task so a key never points at someone else's file. */
export function attachmentKey(userId: string, taskId: string, attachmentId: string) {
  return `${userId}/${taskId}/${attachmentId}`
}

/** Content-Disposition value that always downloads and survives non-ASCII file names. */
export function attachmentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\%]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
