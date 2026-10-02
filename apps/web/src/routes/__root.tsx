import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // Without this a phone lays the page out 980px wide and shrinks it.
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Todo — 今日をひとつずつ' },
      { name: 'description', content: 'タスクを整理して、締め切りを見逃さない。' },
    ],
  }),
  component: () => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
})
