# 全体アーキテクチャ

![構成図](architecture.png)

Cloudflare 上で動く Web アプリ (TanStack Start) と、リマインド用のワーカーの 2 つの Worker で構成する。

## コンポーネント

| コンポーネント                   | 役割                                                    | 状態                                                                                               |
| -------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Workers (`apps/web`)             | 画面、タスク API、認証                                  | 実装済み → [Web アプリ仕様](web-app.md)                                                            |
| Workers (`apps/reminder-worker`) | cron で起動し、リマインドを Queues に積み、メールを送る | 実装済み。送信設定は [#8](https://github.com/tknkaa/todo-app/issues/8) → [ワーカー仕様](worker.md) |
| D1                               | ユーザー、セッション、タスクの保存                      | 実装済み → [テーブル定義](database.md)                                                             |
| Cron Triggers                    | リマインド Worker を 15 分ごとに起動                    | 実装済み                                                                                           |
| Queues                           | リマインドメールの送信キュー                            | 実装済み                                                                                           |
| Resend                           | リマインドメールの送信                                  | コードあり。API キーとドメインの設定は未了                                                         |
| R2                               | タスクのファイル添付                                    | 予定。binding のみ (`FILES`)                                                                       |
| Durable Objects                  | タスクの同時編集                                        | 予定。空のクラスと binding のみ (`COLLABORATION`)                                                  |

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

## ドキュメント一覧

- [Web アプリ仕様](web-app.md)
- [テーブル定義](database.md)
- [ワーカー仕様](worker.md)
- [開発](development.md)
