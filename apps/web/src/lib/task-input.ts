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

const positionMessage = '並び順が正しくありません。'

export const MAX_DESCRIPTION_LENGTH = 20_000

const descriptionMessage = `本文は ${MAX_DESCRIPTION_LENGTH.toLocaleString('en-US')} 文字以内にしてください。`
const versionMessage = '本文を保存するには、読み込んだときの版 (descriptionVersion) が必要です。'

const updateObject = v.object({
  title: v.optional(titleSchema),
  dueAt: v.optional(dueAtSchema),
  remindBeforeMinutes: v.optional(remindBeforeSchema),
  description: v.optional(
    v.pipe(v.string(descriptionMessage), v.maxLength(MAX_DESCRIPTION_LENGTH, descriptionMessage)),
  ),
  descriptionVersion: v.optional(
    v.pipe(v.number(versionMessage), v.integer(versionMessage), v.minValue(0, versionMessage)),
  ),
  position: v.optional(
    v.pipe(
      v.number(positionMessage),
      v.finite(positionMessage),
      v.minValue(-1e12, positionMessage),
      v.maxValue(1e12, positionMessage),
    ),
  ),
  status: v.optional(
    v.picklist(TASK_STATUSES, 'status は todo / doing / done のいずれかを指定してください。'),
  ),
})

// The body can only be saved together with the version it was edited from.
const updateTaskSchema = v.pipe(
  updateObject,
  v.forward(
    v.check(
      (input) => input.description === undefined || input.descriptionVersion !== undefined,
      versionMessage,
    ),
    ['descriptionVersion'],
  ),
)

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
  const { title, dueAt, status, remindBeforeMinutes, position, description } = result.output
  if (
    title === undefined &&
    dueAt === undefined &&
    status === undefined &&
    remindBeforeMinutes === undefined &&
    position === undefined &&
    description === undefined
  ) {
    return { ok: false, message: '変更する項目を指定してください。' }
  }
  return { ok: true, value: result.output }
}
