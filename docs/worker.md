# ワーカー仕様

対象: `apps/reminder-worker`。締め切りが近いタスクを、メールでリマインドする。

実装: `src/index.ts`、検索: `packages/db/src/tasks/reminders.ts`

## ハンドラ

| ハンドラ    | 起動                      | 内容                                |
| ----------- | ------------------------- | ----------------------------------- |
| `scheduled` | Cron Triggers (15 分ごと) | 対象のタスクを探して、Queues に積む |
| `queue`     | Queues (`todo-reminders`) | メールを送る                        |

cron と Queues の設定は `wrangler.jsonc` (`triggers.crons`、`queues`)。

## 流れ

1. `scheduled` が、次の条件をすべて満たすタスクを D1 から探す。
   - リマインドがオン (`remind_before_minutes` が NULL でない)。既定はオフ
   - 未完了
   - 「締め切り − `remind_before_minutes`」の時刻を過ぎていて、締め切りはまだ先
   - まだリマインドをキューに積んでいない (`reminder_queued_at` が NULL)
2. 見つかったタスクを Queues に積み、`reminder_queued_at` に時刻を記録する。
3. `queue` が、Resend の API でメールを送る。

## メール

- 宛先: タスクの所有者のメールアドレス
- 件名: `締め切りが近いタスク: <タイトル>`
- 本文: `「<タイトル>」の締め切りは <締め切り> です。`

## 方針

- 1 つのタスクにつきリマインドは 1 回。`reminder_queued_at` が入ったタスクは再度対象にならない。
- 締め切りかリマインドの設定を変えると `reminder_queued_at` を空に戻し、新しい設定でもう一度リマインドする。
- cron は 15 分ごとなので、実際の送信は設定した時刻から最大 15 分遅れる。
- 宛先はタスクの所有者だけ。共有された人には送らない。
- キューの設定: 1 バッチ最大 10 件、最大 3 回までリトライ。

## 設定

| 名前             | 内容                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` | Resend の API キー                                                                                           |
| `REMINDER_FROM`  | 送信元アドレス。本番は独自ドメインの検証が必要 (開発中は `onboarding@resend.dev` で、自分のアカウント宛のみ) |

## 未了・課題

[#8](https://github.com/tknkaa/todo-app/issues/8) で扱う。

- 上記の設定 (`REMINDER_FROM` は `wrangler.jsonc` にも未定義)
- 送信に失敗したときの扱い。いまは `reminder_queued_at` を先に記録するため、送信が最終的に失敗するとリマインドは再送されない。
