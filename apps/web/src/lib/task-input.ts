import * as v from 'valibot'
import { MAX_REMIND_BEFORE_MINUTES } from './reminder'
import { TASK_STATUSES } from './status'

const titleMessage = 'タイトルは1〜200文字で入力してください。'
const dueAtMessage = '締め切りの日時が正しくありません。'

const titleSchema = v.pipe(
  v.string(titleMessage),
  v.trim(),
  v.minLength(1, titleMessage),
  v.maxLength(200, titleMessage),
)

const dueAtSchema = v.nullable(
  v.pipe(
    v.string(dueAtMessage),
    v.check((value) => value === '' || !Number.isNaN(Date.parse(value)), dueAtMessage),
    v.transform((value) => (value === '' ? null : new Date(value).toISOString())),
  ),
)

const remindMessage = 'リマインドの時間が正しくありません。'

const remindBeforeSchema = v.nullable(
  v.pipe(
    v.number(remindMessage),
    v.integer(remindMessage),
    v.minValue(1, remindMessage),
    v.maxValue(MAX_REMIND_BEFORE_MINUTES, remindMessage),
  ),
)

const createTaskSchema = v.object({
  title: titleSchema,
  dueAt: v.optional(dueAtSchema, null),
  remindBeforeMinutes: v.optional(remindBeforeSchema, null),
})

const updateTaskSchema = v.object({
  title: v.optional(titleSchema),
  dueAt: v.optional(dueAtSchema),
  remindBeforeMinutes: v.optional(remindBeforeSchema),
  status: v.optional(
    v.picklist(TASK_STATUSES, 'status は todo / doing / done のいずれかを指定してください。'),
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

export type UpdateTaskInput = v.InferOutput<typeof updateTaskSchema>

export type UpdateParseResult =
  | { ok: true; value: UpdateTaskInput }
  | { ok: false; message: string }

/** Validates a partial update. Only the given fields change; at least one is required. */
export function parseUpdateTaskInput(input: unknown): UpdateParseResult {
  const result = v.safeParse(updateTaskSchema, input)
  if (!result.success) {
    return { ok: false, message: result.issues[0]?.message ?? '入力を確認してください。' }
  }
  const { title, dueAt, status, remindBeforeMinutes } = result.output
  if (
    title === undefined &&
    dueAt === undefined &&
    status === undefined &&
    remindBeforeMinutes === undefined
  ) {
    return { ok: false, message: '変更する項目を指定してください。' }
  }
  return { ok: true, value: result.output }
}
