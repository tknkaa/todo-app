# テーブル定義

Cloudflare D1 (SQLite)。スキーマは `packages/db/src/schema.ts` (Drizzle)、マイグレーションは `packages/db/migrations/`。

日時の列は `TEXT` で、既定値は `CURRENT_TIMESTAMP`。認証のテーブルは better-auth が使う。

## users

ユーザー。

| 列               | 型                | 制約                | 内容   |
| ---------------- | ----------------- | ------------------- | ------ |
| `id`             | TEXT              | PK                  |        |
| `name`           | TEXT              | NOT NULL、既定 `''` | 表示名 |
| `email`          | TEXT              | NOT NULL、UNIQUE    |        |
| `email_verified` | INTEGER (boolean) | NOT NULL、既定 0    |        |
| `image`          | TEXT              |                     |        |
| `created_at`     | TEXT              | NOT NULL            |        |
| `updated_at`     | TEXT              | NOT NULL            |        |

## sessions

ログインセッション。

| 列           | 型   | 制約                                         | 内容 |
| ------------ | ---- | -------------------------------------------- | ---- |
| `id`         | TEXT | PK                                           |      |
| `user_id`    | TEXT | NOT NULL、FK → `users.id` (削除時に連鎖削除) |      |
| `token`      | TEXT | NOT NULL、UNIQUE                             |      |
| `expires_at` | TEXT | NOT NULL                                     |      |
| `ip_address` | TEXT |                                              |      |
| `user_agent` | TEXT |                                              |      |
| `created_at` | TEXT | NOT NULL                                     |      |
| `updated_at` | TEXT | NOT NULL                                     |      |

インデックス: `sessions_user_id_idx` (`user_id`)

## accounts

認証方式ごとのアカウント情報。パスワードのハッシュや、将来の OAuth のトークンを持つ。

| 列                         | 型   | 制約                                         | 内容                             |
| -------------------------- | ---- | -------------------------------------------- | -------------------------------- |
| `id`                       | TEXT | PK                                           |                                  |
| `user_id`                  | TEXT | NOT NULL、FK → `users.id` (削除時に連鎖削除) |                                  |
| `account_id`               | TEXT | NOT NULL                                     | 認証方式側のアカウント ID        |
| `provider_id`              | TEXT | NOT NULL                                     | 認証方式 (メール/パスワードなど) |
| `password`                 | TEXT |                                              | パスワードのハッシュ             |
| `access_token`             | TEXT |                                              |                                  |
| `refresh_token`            | TEXT |                                              |                                  |
| `id_token`                 | TEXT |                                              |                                  |
| `access_token_expires_at`  | TEXT |                                              |                                  |
| `refresh_token_expires_at` | TEXT |                                              |                                  |
| `scope`                    | TEXT |                                              |                                  |
| `created_at`               | TEXT | NOT NULL                                     |                                  |
| `updated_at`               | TEXT | NOT NULL                                     |                                  |

インデックス: `accounts_user_id_idx` (`user_id`)

## verifications

確認用のトークン。

| 列           | 型   | 制約     | 内容 |
| ------------ | ---- | -------- | ---- |
| `id`         | TEXT | PK       |      |
| `identifier` | TEXT | NOT NULL |      |
| `value`      | TEXT | NOT NULL |      |
| `expires_at` | TEXT | NOT NULL |      |
| `created_at` | TEXT |          |      |
| `updated_at` | TEXT |          |      |

インデックス: `verifications_identifier_idx` (`identifier`)

## tasks

タスク。仕様は [Web アプリ仕様](web-app.md)、リマインドは [ワーカー仕様](worker.md) を参照。

| 列                   | 型   | 制約                      | 内容                                            |
| -------------------- | ---- | ------------------------- | ----------------------------------------------- |
| `id`                 | TEXT | PK                        | UUID                                            |
| `user_id`            | TEXT | NOT NULL、FK → `users.id` | 所有者                                          |
| `title`              | TEXT | NOT NULL                  | 1〜200 文字 (アプリ側で検証)                    |
| `due_at`             | TEXT |                           | 締め切り (UTC の ISO 8601)                      |
| `completed_at`       | TEXT |                           | 完了日時。未完了は NULL                         |
| `reminder_queued_at` | TEXT |                           | リマインドをキューに積んだ日時。NULL なら未処理 |
| `created_at`         | TEXT | NOT NULL                  |                                                 |

インデックス: `tasks_due_at_idx` (`due_at`, `completed_at`, `reminder_queued_at`)。リマインドの検索用。

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
