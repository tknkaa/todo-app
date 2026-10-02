# リマインド

実装: `apps/reminder-worker/src/index.ts`、検索: `packages/db/src/tasks/reminders.ts`

## 流れ

1. Cron Triggers が 15 分ごとに `scheduled` を呼ぶ (`apps/reminder-worker/wrangler.jsonc` の `triggers.crons`)。
2. 次の条件をすべて満たすタスクを探す。
   - 未完了
   - 締め切りが「いま」より後、かつ 24 時間以内
   - まだリマインドをキューに積んでいない (`reminderQueuedAt` が空)
3. 見つかったタスクを Queues (`todo-reminders`) に積み、`reminderQueuedAt` に時刻を記録する。
4. コンシューマ (`queue`) が Resend の API でメールを送る。

## メール

- 宛先: タスクの所有者のメールアドレス
- 件名: `締め切りが近いタスク: <タイトル>`
- 本文: `「<タイトル>」の締め切りは <締め切り> です。`

## 方針

- 1 つのタスクにつきリマインドは 1 回。`reminderQueuedAt` が入ったタスクは再度対象にならない。
- キューの設定: 1 バッチ最大 10 件、最大 3 回までリトライ。

## 設定

| 名前             | 内容                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` | Resend の API キー                                                                                           |
| `REMINDER_FROM`  | 送信元アドレス。本番は独自ドメインの検証が必要 (開発中は `onboarding@resend.dev` で、自分のアカウント宛のみ) |

## 未了・課題

[#8](https://github.com/tknkaa/todo-app/issues/8) で扱う。

- 上記の設定 (`REMINDER_FROM` は `wrangler.jsonc` にも未定義)
- 送信に失敗したときの扱い。いまは `reminderQueuedAt` を先に記録するため、送信が最終的に失敗するとリマインドは再送されない。
- 締め切りを変更したときに、リマインドをやり直すかどうか。
