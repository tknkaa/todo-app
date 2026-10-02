# デプロイとプレビュー

Cloudflare にデプロイする手順。**ここに書いたことのうち、リソースの作成、シークレットの設定、ダッシュボードの設定は、Cloudflare のアカウントが要るので、まだ実際には試していない。** 確認できているのは、Wrangler の設定が正しく読めること (`pnpm check:deploy`、CI でも実行する) まで。

[#3](https://github.com/ut-code/kanban/issues/3) で扱う。

## 名前

Cloudflare のリソースの名前は、**Cloudflare のアカウントの中で一意**になる (GitHub の org ではない)。共有のアカウントで他のプロジェクトとぶつからないよう、すべての名前に `kanban-` を付けている。名前を変えるときは、`wrangler.jsonc` (2 つ)、`apps/reminder-worker/src/index.ts` (通知のキューの名前)、`package.json` と `justfile` と `e2e/start-server.sh` (D1 の名前)、この docs をそろえて直す。

## アカウントの指定

Wrangler が複数のアカウントにログインしているときは、どれを使うかを環境変数で指定する (指定しないと、対話できない場所ではエラーになる)。

```sh
export CLOUDFLARE_ACCOUNT_ID=<アカウント ID>     # `wrangler whoami` で分かる
```

## 構成

| Worker                   | 設定                                       | 役割                                                                |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| `kanban-web`             | `apps/web/wrangler.jsonc`                  | 画面、API                                                           |
| `kanban-reminder-worker` | `apps/reminder-worker/wrangler.jsonc`      | リマインドと共有の通知のメール (cron、Queues)                       |
| `kanban-web-preview`     | `apps/web/wrangler.jsonc` の `env.preview` | ブランチや PR の動作確認用。本番とは別の DB、バケット、キューを使う |

プレビューにはリマインド用のワーカーを置かない。cron が動いて、本番と同じようにメールを送ってしまうのを避けるため。

## 1. リソースを作る (最初の 1 回)

Wrangler にログインする (`pnpm --filter @todo/web exec wrangler login`)。

```sh
cd apps/web
# 本番
pnpm exec wrangler d1 create kanban-db                  # 出てきた database_id を、下の 2 つの設定に書く
pnpm exec wrangler r2 bucket create kanban-files
pnpm exec wrangler queues create kanban-reminders
pnpm exec wrangler queues create kanban-notifications
pnpm exec wrangler queues create kanban-mail-dead-letter   # 再試行しても送れなかったメールの置き場

# プレビュー
pnpm exec wrangler d1 create kanban-db-preview          # database_id を apps/web/wrangler.jsonc の env.preview に書く
pnpm exec wrangler r2 bucket create kanban-files-preview
pnpm exec wrangler queues create kanban-notifications-preview
```

`database_id` を書く場所 (ut-code のアカウントに作成済みで、書き込み済み):

- `apps/web/wrangler.jsonc` の `d1_databases` (本番) と `env.preview.d1_databases` (プレビュー)
- `apps/reminder-worker/wrangler.jsonc` の `d1_databases` (本番。リマインドの対象を探すため、Web と同じ DB を指す)

## 2. データベースを用意する

```sh
pnpm db:migrate:remote     # 本番
pnpm db:migrate:preview    # プレビュー
```

マイグレーションを足したら、デプロイの前に適用する (下の Workers Builds では、デプロイのコマンドに含める)。

## 3. 設定値とシークレット

シークレットは `wrangler secret put` で入れる (リポジトリには書かない)。プレビューには `--env preview` を付ける。

| 名前                                        | どこに                   | 内容                                                                                                            |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | web (本番、プレビュー)   | 長いランダム文字列 (`openssl rand -hex 32`)。本番とプレビューで別の値にする                                     |
| `BETTER_AUTH_URL`                           | web (本番、プレビュー)   | そのアプリの公開 URL (例 `https://todo.example.com`)。ログインのオリジン確認に使うので、実際の URL と一致させる |
| `RESEND_API_KEY`                            | reminder-worker          | Resend の API キー。詳しくは [ワーカー仕様](worker.md)                                                          |
| `REMINDER_FROM`                             | reminder-worker (`vars`) | 送信元アドレス。独自ドメインの検証が要る                                                                        |
| `APP_URL`                                   | reminder-worker (`vars`) | メールのリンクの先 (本番の公開 URL)                                                                             |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | web                      | Google でログインするとき ([#2](https://github.com/ut-code/kanban/issues/2))                                    |

```sh
cd apps/web
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env preview
```

`BETTER_AUTH_URL` は、`wrangler.jsonc` の `vars` に書くか、ダッシュボードの Variables で設定する。

**プレビューの URL の注意:** ログインは、`BETTER_AUTH_URL` と同じオリジンからのリクエストしか受け付けない。プレビューでログインを試すには、`https://kanban-web-preview.<アカウントのサブドメイン>.workers.dev` のように、**固定の URL** を `BETTER_AUTH_URL` に設定して、その URL で開く。ブランチごとに変わるバージョンの URL (`<ハッシュ>-kanban-web-preview…`) では、ログインできない。

## 4. 初回のデプロイ

```sh
pnpm deploy:web        # 本番の Web
pnpm deploy:worker     # リマインド用のワーカー
pnpm deploy:preview    # プレビューの Web (Worker を作るため、最初に 1 回)
```

## 5. Cloudflare 側で、自動のデプロイとプレビューを設定する (Workers Builds)

ダッシュボードの Workers & Pages で、Worker ごとに、リポジトリ (`ut-code/kanban`) を接続する。Worker の名前は、設定ファイルの `name` と同じにする。

**`kanban-web`** (本番とプレビューを兼ねる):

| 設定                          | 値                                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root directory                | `/`                                                                                                                                                                         |
| Build command                 | `pnpm install --frozen-lockfile && pnpm --filter @todo/web build`                                                                                                           |
| Deploy command (`main`)       | `pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db --remote && pnpm --filter @todo/web exec wrangler deploy`                                              |
| Production branch             | `main`                                                                                                                                                                      |
| Non-production branch builds  | 有効                                                                                                                                                                        |
| Non-production deploy command | `pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db-preview --remote --env preview && pnpm --filter @todo/web exec wrangler versions upload --env preview` |
| Build watch paths             | `apps/web/**`、`packages/**`、`pnpm-lock.yaml`                                                                                                                              |

- `main` に入ると、本番の DB にマイグレーションを適用してから、デプロイする。
- `main` 以外のブランチや PR は、プレビュー用の DB にマイグレーションを適用して、`kanban-web-preview` の新しいバージョンとして、本番に出さずにアップロードする。ダッシュボードや PR のコメントに、そのバージョンの URL が出る (上の注意のとおり、ログインには固定の URL を使う)。

**`kanban-reminder-worker`** (本番だけ。プレビューなし):

| 設定                  | 値                                                         |
| --------------------- | ---------------------------------------------------------- |
| Root directory        | `/`                                                        |
| Build command         | `pnpm install --frozen-lockfile`                           |
| Deploy command        | `pnpm --filter @todo/reminder-worker exec wrangler deploy` |
| Non-production builds | 無効                                                       |
| Build watch paths     | `apps/reminder-worker/**`、`packages/**`、`pnpm-lock.yaml` |

## 6. 確認すること

- [ ] `main` へのマージで、本番にデプロイされ、マイグレーションが適用される
- [ ] PR のブランチで、プレビューのバージョンができ、本番のデータに触れない
- [ ] 本番で、ログイン、タスクの追加、添付、共有、リアルタイムの反映が動く (WebSocket と Durable Objects は、本番の設定で初めて確かめる)
- [ ] リマインドの cron が動く (ダッシュボードの Triggers で、実行の履歴を見る)
- [ ] メールが届く ([ワーカー仕様](worker.md) の「未了」)
- [ ] デッドレターキュー (`kanban-mail-dead-letter`) に、送れなかったメールが溜まっていない

## 設定を変えたとき

`pnpm check:deploy` で、`apps/web` (本番とプレビュー) と `apps/reminder-worker` の設定が、まだ正しく読めることを確かめる (アップロードはしない)。CI の `check` ジョブでも実行する。
