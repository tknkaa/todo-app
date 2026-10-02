# アーキテクチャ

![構成図](architecture.png)

Cloudflare 上で動く TanStack Start のアプリと、リマインド用の Worker の 2 つで構成する。

| コンポーネント                   | 役割                                                             | 状態                                                                   |
| -------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Workers (`apps/web`)             | 画面 (TanStack Start)、タスク API、認証                          | 実装済み                                                               |
| D1                               | ユーザー、セッション、タスクの保存                               | 実装済み                                                               |
| Workers (`apps/reminder-worker`) | Cron Triggers で起動し、リマインドを Queues に積み、メールを送る | 実装済み。送信設定は [#8](https://github.com/tknkaa/todo-app/issues/8) |
| Cron Triggers                    | リマインド Worker を 15 分ごとに起動                             | 実装済み                                                               |
| Queues                           | リマインドメールの送信キュー                                     | 実装済み                                                               |
| Resend                           | リマインドメールの送信                                           | コードあり。API キーとドメイン設定は未了                               |
| R2                               | タスクのファイル添付                                             | 予定。binding のみ (`FILES`)                                           |
| Durable Objects                  | タスクの同時編集                                                 | 予定。空のクラスと binding のみ (`COLLABORATION`)                      |

## リポジトリ構成

```
apps/
  web/                 画面、HTTP ハンドラ、認証
    src/lib/           純粋な関数 (入力検証、整形など)。テストあり
    src/server/        Worker 側の処理 (認証、タスク API)
  reminder-worker/     cron で起動するリマインド処理
packages/
  db/                  Drizzle のスキーマ、マイグレーション、D1 リポジトリ、共有する型
docs/                  このドキュメント
```

- 2 つの Worker が共有するのは DB のコードと型だけなので、`packages/` は `db` の 1 つにしている。
- 純粋な関数は `apps/web/src/lib/` に置き、ユニットテストを書く。ハンドラはインメモリ SQLite を使って通しでテストする。

## データの流れ

- **タスク操作:** ブラウザ → `apps/web` の `/api/tasks` → D1。リクエストごとにセッションを確認し、ログインしていなければ 401 を返す。
- **リマインド:** Cron → `reminder-worker` が D1 から対象タスクを検索 → Queues に投入 → 同じ Worker のコンシューマが Resend でメール送信。
