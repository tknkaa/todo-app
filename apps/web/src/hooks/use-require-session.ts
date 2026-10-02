import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

/** The signed-in session, or null while it loads. Sends visitors who are not signed in to /login. */
export function useRequireSession() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session) void navigate({ to: '/login', search: { error: undefined } })
  }, [isPending, session, navigate])

  return session
}
