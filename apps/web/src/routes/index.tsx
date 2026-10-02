import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main>
      <h1>Todo</h1>
      <p>タスクを整理して、締め切りを見逃さない。</p>
    </main>
  )
}
