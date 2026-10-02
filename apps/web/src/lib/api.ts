export async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? 'リクエストに失敗しました。'
}

export function messageOf(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}
