import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

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
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button className="h-11" type="submit" disabled={pending}>
          {mode === 'signIn' ? 'ログイン' : '登録する'}
        </Button>
      </form>
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
