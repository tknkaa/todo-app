import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { oauthErrorMessage } from '@/lib/oauth-error'

export const Route = createFileRoute('/login')({
  // better-auth sends a failed sign-in with GitHub back here as `/login?error=<code>`.
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const { error: oauthError } = Route.useSearch()
  const { data: session } = authClient.useSession()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [github, setGithub] = useState(false)

  // Which sign-in buttons exist depends on what the server has been given keys for.
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await fetch('/api/config')
        const config = (await response.json()) as { github?: boolean }
        if (active) setGithub(config.github === true)
      } catch {
        // No config means no extra buttons.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (session) void navigate({ to: '/' })
  }, [session, navigate])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const name = String(formData.get('name') ?? '') || email
    setPending(true)
    setError('')
    const result =
      mode === 'signIn'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name })
    setPending(false)
    if (result.error) {
      setError(result.error.message ?? '認証に失敗しました。')
      return
    }
    await navigate({ to: '/' })
  }

  return (
    <main className="mx-auto w-full max-w-[400px] px-5 pt-24 pb-8">
      <h1 className="mb-2 text-2xl font-semibold tracking-[-0.04em]">
        {mode === 'signIn' ? 'ログイン' : 'アカウントを作成'}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        メールアドレスとパスワードで{mode === 'signIn' ? 'ログイン' : '登録'}します。
      </p>
      <form className="grid gap-3" onSubmit={submit}>
        {mode === 'signUp' && (
          <Input name="name" className="h-11" placeholder="名前" autoComplete="name" />
        )}
        <Input
          name="email"
          type="email"
          className="h-11"
          placeholder="メールアドレス"
          autoComplete="email"
          required
        />
        <Input
          name="password"
          type="password"
          className="h-11"
          placeholder="パスワード（8文字以上）"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          minLength={8}
          required
        />
        {(error || oauthError) && (
          <p className="text-sm text-destructive" role="alert">
            {error || (oauthError ? oauthErrorMessage(oauthError) : '')}
          </p>
        )}
        <Button className="h-11" type="submit" disabled={pending}>
          {mode === 'signIn' ? 'ログイン' : '登録する'}
        </Button>
      </form>
      {github && (
        <Button
          className="mt-3 h-11 w-full"
          variant="outline"
          type="button"
          onClick={() =>
            void authClient.signIn.social({
              provider: 'github',
              callbackURL: '/',
              errorCallbackURL: '/login',
            })
          }
        >
          GitHub でログイン
        </Button>
      )}
      <Button
        variant="ghost"
        className="mt-4 w-full text-muted-foreground"
        type="button"
        onClick={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn')
          setError('')
        }}
      >
        {mode === 'signIn' ? 'アカウントを作成する' : 'ログインに戻る'}
      </Button>
    </main>
  )
}
