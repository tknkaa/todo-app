import * as v from 'valibot'

const titleMessage = 'タイトルは1〜200文字で入力してください。'
const dueAtMessage = '締め切りの日時が正しくありません。'

const createTaskSchema = v.object({
  title: v.pipe(
    v.string(titleMessage),
    v.trim(),
    v.minLength(1, titleMessage),
    v.maxLength(200, titleMessage),
  ),
  dueAt: v.optional(
    v.nullable(
      v.pipe(
        v.string(dueAtMessage),
        v.check((value) => value === '' || !Number.isNaN(Date.parse(value)), dueAtMessage),
        v.transform((value) => (value === '' ? null : new Date(value).toISOString())),
      ),
    ),
    null,
  ),
})

export type CreateTaskInput = v.InferOutput<typeof createTaskSchema>

export type ParseResult = { ok: true; value: CreateTaskInput } | { ok: false; message: string }

/** Validates and normalizes untrusted input: trims the title and turns the deadline into an ISO string. */
export function parseCreateTaskInput(input: unknown): ParseResult {
  const result = v.safeParse(createTaskSchema, input)
  if (result.success) return { ok: true, value: result.output }
  return { ok: false, message: result.issues[0]?.message ?? '入力を確認してください。' }
}

export function completionTimestamp(completed: boolean, now: Date): string | null {
  return completed ? now.toISOString() : null
}
