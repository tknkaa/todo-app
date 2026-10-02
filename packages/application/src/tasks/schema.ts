import * as v from 'valibot'

const deadlineSchema = v.nullable(
  v.pipe(
    v.string(),
    v.check((value) => !Number.isNaN(Date.parse(value)), '締め切りの日時が正しくありません。'),
    v.transform((value) => new Date(value).toISOString()),
  ),
)

export const createTaskInputSchema = v.object({
  id: v.string(),
  userId: v.string(),
  title: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'タイトルは1〜200文字で入力してください。'),
    v.maxLength(200, 'タイトルは1〜200文字で入力してください。'),
  ),
  dueAt: deadlineSchema,
})

export type CreateTaskInput = v.InferInput<typeof createTaskInputSchema>
export type ValidCreateTaskInput = v.InferOutput<typeof createTaskInputSchema>
