# データベース

Cloudflare D1 (SQLite)。スキーマは `packages/db/src/schema.ts` (Drizzle)、マイグレーションは `packages/db/migrations/`。

## テーブル

| テーブル        | 内容                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `users`         | ユーザー (better-auth の `user`)。`id`、`name`、`email` (一意)、`emailVerified`、`image`、`createdAt`、`updatedAt` |
| `sessions`      | ログインセッション。`userId` で `users` に紐づき、ユーザー削除時に連鎖削除                                         |
| `accounts`      | 認証方式ごとのアカウント情報 (パスワードのハッシュ、将来の OAuth トークン)。`userId` で連鎖削除                    |
| `verifications` | 確認用トークン                                                                                                     |
| `tasks`         | タスク。詳細は [tasks.md](tasks.md)。`userId` で `users` に紐づく                                                  |

`tasks` には、リマインドの検索用に `(dueAt, completedAt, reminderQueuedAt)` のインデックスがある。

## マイグレーション

- スキーマを変えたら `pnpm db:generate` で SQL を生成する。
- 名前は内容が分かるものにする (例: `0002_add_better_auth_tables`)。
- 適用済みのマイグレーションの名前やファイルは変更しない。
- ローカルへの適用: `pnpm db:migrate:local`、本番: `pnpm db:migrate:remote`。

## ローカルのデータを見る

```sh
just sql "select * from tasks"
```

`just` が使えない場合は、`apps/web` で `pnpm exec wrangler d1 execute todo-db --local --persist-to .wrangler/state-drizzle-baseline --command "..."` を実行する。
