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

## いまの状態 (ut-code のアカウント `ut.code();`)

|                               | 状態                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| リソース                      | D1 2 個、R2 2 個、キュー 4 つ。作成済み                                                                                                                                       |
| マイグレーション              | 本番とプレビューの両方に、すべて適用済み                                                                                                                                      |
| `kanban-web` (本番)           | デプロイ済み: https://kanban-web.ut-code.workers.dev                                                                                                                          |
| `kanban-web-preview`          | デプロイ済み: https://kanban-web-preview.ut-code.workers.dev (別の DB)                                                                                                        |
| `kanban-reminder-worker`      | デプロイ済み (cron は 15 分ごと)。公開 URL はない (`workers_dev: false`)                                                                                                      |
| シークレット                  | `BETTER_AUTH_SECRET` は、本番とプレビューに設定済み (別の値)                                                                                                                  |
| デプロイ後の確認              | プレビューで、アカウント作成、タスク、状態の変更、添付 (R2)、共有 (キュー)、WebSocket と Durable Objects を確認済み。本番には、データを作らないよう、アカウントは作っていない |
| Workers Builds (自動デプロイ) | **未設定**。下の 5 を、ダッシュボードで設定する                                                                                                                               |
| メール (Resend)               | **未設定** ([#8](https://github.com/ut-code/kanban/issues/8))。それまで、メールの送信は失敗して、デッドレターキューに溜まる                                                   |
| Google ログイン               | **未設定** ([#2](https://github.com/ut-code/kanban/issues/2))                                                                                                                 |

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

| 名前                                        | どこに                           | 内容                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`                        | web (本番、プレビュー)           | 長いランダム文字列 (`openssl rand -hex 32`)。本番とプレビューで別の値にする                                                                                                    |
| `BETTER_AUTH_URL`                           | web (`wrangler.jsonc` の `vars`) | そのアプリの公開 URL。ログインのオリジン確認に使うので、実際の URL と一致させる。本番は `https://kanban-web.ut-code.workers.dev`、プレビューは `env.preview.vars` に書いてある |
| `RESEND_API_KEY`                            | reminder-worker                  | Resend の API キー。詳しくは [ワーカー仕様](worker.md)                                                                                                                         |
| `REMINDER_FROM`                             | reminder-worker (`vars`)         | 送信元アドレス。独自ドメインの検証が要る                                                                                                                                       |
| `APP_URL`                                   | reminder-worker (`vars`)         | メールのリンクの先。本番の公開 URL (`https://kanban-web.ut-code.workers.dev`)                                                                                                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | web                              | Google でログインするとき ([#2](https://github.com/ut-code/kanban/issues/2))                                                                                                   |

```sh
cd apps/web
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env preview
```

`BETTER_AUTH_URL` と `APP_URL` は、公開してよい値なので、シークレットではなく `wrangler.jsonc` の `vars` に書いてある。ローカルの `pnpm dev` は、`apps/web/.dev.vars` の値を使う。

シークレットを入れた直後は、反映まで数十秒かかる。そのあいだ、古いバージョンが応答して、ログインしているのに 401 になるなど、結果が一定しないことがある。少し待ってから試す。

**プレビューは「ステージング」(1 つの枠):** このアプリの Web は Durable Objects を使っているので、**Cloudflare の「バージョンごとのプレビュー URL」(`wrangler versions upload` で作られる、`<ハッシュ>-kanban-web-preview…`) は作られない** (実際に試して、開けないことを確認した)。そのため、プレビューは、固定の URL (`https://kanban-web-preview.ut-code.workers.dev`) に、`wrangler deploy --env preview` でデプロイして使う。ログインは、`BETTER_AUTH_URL` と同じオリジンからのリクエストしか受け付けないので、この固定の URL を `BETTER_AUTH_URL` に設定してある。

## 4. 初回のデプロイ

```sh
pnpm deploy:web        # 本番の Web (中身は `pnpm --filter @todo/web run deploy`。`pnpm deploy` は pnpm 自身の別のコマンドなので、`run` が要る)
pnpm deploy:worker     # リマインド用のワーカー
pnpm deploy:preview    # プレビューの Web (Worker を作るため、最初に 1 回)
```

## 5. Cloudflare 側で、自動のデプロイとプレビューを設定する (Workers Builds)

ダッシュボードの Workers & Pages で、Worker ごとに、リポジトリ (`ut-code/kanban`) を接続する。Worker の名前は、設定ファイルの `name` と同じにする。

**`kanban-web`** (本番とプレビューを兼ねる):

| 設定                          | 値                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Root directory                | `/`                                                                                                                                                                |
| Build command                 | `pnpm install --frozen-lockfile && pnpm --filter @todo/web build`                                                                                                  |
| Deploy command (`main`)       | `pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db --remote && pnpm --filter @todo/web exec wrangler deploy`                                     |
| Production branch             | `main`                                                                                                                                                             |
| Non-production branch builds  | 有効                                                                                                                                                               |
| Non-production deploy command | `pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db-preview --remote --env preview && pnpm --filter @todo/web exec wrangler deploy --env preview` |
| Build watch paths             | `apps/web/**`、`packages/**`、`pnpm-lock.yaml`                                                                                                                     |

- `main` に入ると、本番の DB にマイグレーションを適用してから、デプロイする。
- `main` 以外のブランチや PR は、プレビュー用の DB にマイグレーションを適用して、`kanban-web-preview` にデプロイする。**固定の URL に載るのは、最後にビルドされたブランチ 1 つだけ**で、別のブランチをプッシュすると上書きされる。複数の PR を同時に見ることはできないので、PR のコメントにプレビューの URL が出るとは限らない (出なくても、URL は固定なので、そこを開く)。プレビュー用の DB も 1 つを共有するので、列の削除や名前の変更を含む PR を出すと、他のブランチのプレビューが壊れることがある。壊れたら、プレビュー用の DB を作り直す。

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
- [ ] PR のブランチのビルドが、`kanban-web-preview` にデプロイされ、本番のデータに触れない
- [ ] 本番で、ログイン、タスクの追加、添付、共有、リアルタイムの反映が動く (WebSocket と Durable Objects は、本番の設定で初めて確かめる)
- [ ] リマインドの cron が動く (ダッシュボードの Triggers で、実行の履歴を見る)
- [ ] メールが届く ([ワーカー仕様](worker.md) の「未了」)
- [ ] デッドレターキュー (`kanban-mail-dead-letter`) に、送れなかったメールが溜まっていない

## 設定を変えたとき

`pnpm check:deploy` で、`apps/web` (本番とプレビュー) と `apps/reminder-worker` の設定が、まだ正しく読めることを確かめる (アップロードはしない)。CI の `check` ジョブでも実行する。
