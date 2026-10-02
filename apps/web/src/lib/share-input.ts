import * as v from 'valibot'

const message = 'メールアドレスを正しく入力してください。'

const shareSchema = v.object(
  { email: v.pipe(v.string(message), v.trim(), v.toLowerCase(), v.email(message)) },
  message,
)

export type ShareParseResult = { ok: true; email: string } | { ok: false; message: string }

/** Validates the email of the person a task is shared with. */
export function parseShareInput(input: unknown): ShareParseResult {
  const result = v.safeParse(shareSchema, input)
  if (result.success) return { ok: true, email: result.output.email }
  return { ok: false, message: result.issues[0]?.message ?? message }
}
