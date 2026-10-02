# 認証

実装: `apps/web/src/server/auth.ts` (better-auth)、画面: `apps/web/src/routes/login.tsx`

## 現状

- メールアドレスとパスワードで登録・ログインする。パスワードは 8 文字以上。
- ログイン状態は better-auth のセッション (Cookie) で管理する。セッションは D1 の `sessions` テーブルに保存する。
- `/` はセッションがなければ `/login` に移動する。未ログインの `/` の HTML にタスク画面は含まれない。
- `/api/tasks` はセッションがなければ 401。
- エンドポイントは `/api/auth/*`。

## 設定

| 名前                 | 内容                                              |
| -------------------- | ------------------------------------------------- |
| `BETTER_AUTH_SECRET` | 必須。長いランダム文字列 (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL`    | 任意。既定は `http://localhost:8787`              |

ローカルでは `apps/web/.dev.vars` に書く。本番は Cloudflare のシークレットに設定する。

## 予定

- Google OAuth ([#2](https://github.com/tknkaa/todo-app/issues/2))
- メールアドレスの確認とパスワードリセットは、現時点では扱わない。必要になったら Resend を使う。
