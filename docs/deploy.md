# デプロイとプレビュー

Cloudflare (ut-code のアカウント `ut.code();`) へのデプロイとプレビュー。デプロイは GitHub の CI ではなく、Cloudflare の **Workers Builds** (ダッシュボードで設定) が行う。

[#3](https://github.com/ut-code/kanban/issues/3) で扱う。

## いまの状態

|                                                | 状態                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 本番の Web (`kanban-web`)                      | デプロイ済み: https://kanban-web.ut-code.workers.dev                                                                              |
| メールを送る Worker (`kanban-reminder-worker`) | デプロイ済み (cron は 15 分ごと)。公開 URL はない (`workers_dev: false`)                                                          |
| プレビュー                                     | Worker Previews。ブランチごとに `https://<ブランチ名>-kanban-web.ut-code.workers.dev`                                             |
| リソース                                       | D1 2 個、R2 2 個、キュー 4 つ (下の表)。マイグレーションは本番とプレビューの両方に適用済み                                        |
| シークレット                                   | `BETTER_AUTH_SECRET` を、本番とプレビュー (全プレビュー共通) に設定済み (別の値)                                                  |
| Workers Builds                                 | ダッシュボードで設定済み (下の 4 の値)                                                                                            |
| メール (Resend)                                | **未設定** ([#8](https://github.com/ut-code/kanban/issues/8))。それまで、本番のメールの送信は失敗して、デッドレターキューに溜まる |
| Google ログイン                                | **未設定** ([#2](https://github.com/ut-code/kanban/issues/2))                                                                     |

## 名前

Cloudflare のリソースの名前は、**Cloudflare のアカウントの中で一意**になる (GitHub の org ではない)。共有のアカウントで他のプロジェクトとぶつからないよう、すべて `kanban-` で始める。

| 種類   | 本番                                                                  | プレビュー (全プレビューで共有)                   |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------- |
| Worker | `kanban-web`、`kanban-reminder-worker`                                | (`kanban-web` の Worker Previews)                 |
| D1     | `kanban-db`                                                           | `kanban-db-preview`                               |
| R2     | `kanban-files`                                                        | `kanban-files-preview`                            |
| キュー | `kanban-reminders`、`kanban-notifications`、`kanban-mail-dead-letter` | `kanban-notifications-preview` (取り出す側はない) |

名前を変えるときは、`wrangler.jsonc` (2 つ)、`apps/web/wrangler.preview-migrations.jsonc`、`apps/reminder-worker/src/index.ts` (通知のキューの名前)、`package.json`、`justfile`、`e2e/start-server.sh`、`scripts/deploy-preview.sh` と `apps/web/src/lib/preview-name.ts` (Worker の名前)、この docs をそろえて直す。

## アカウントの指定

Wrangler が複数のアカウントにログインしているときは、どれを使うかを環境変数で指定する (指定しないと、対話できない場所ではエラーになる)。

```sh
export CLOUDFLARE_ACCOUNT_ID=df6c3acd32f66bd1eb95e50607684297   # ut.code();
```

## 1. 本番 (`main`)

- `main` に入ると、Workers Builds が、本番の D1 にマイグレーションを適用してから、`kanban-web` をデプロイする。
- **merge しただけでは、マイグレーションは走らない。** Workers Builds のデプロイコマンドが `d1 migrations apply` を実行して、初めて適用される。手元からは `pnpm db:migrate:remote`。
- マイグレーションはデプロイより先に走る。列の追加はそのままでよいが、列の削除や名前の変更は、古いコードが壊れるので、2 回に分けて出す。
- `kanban-reminder-worker` は、別の Workers Builds のプロジェクトとしてデプロイする。

## 2. プレビュー (`main` 以外のブランチ)

[Worker Previews](https://developers.cloudflare.com/workers/previews/) を使う。**同じ Worker (`kanban-web`) のまま**、ブランチごとに独立したプレビューができる。

- URL はブランチごとに固定: `https://<プレビュー名>-kanban-web.ut-code.workers.dev`。プレビュー名は、ブランチ名を小文字、数字、`-` にしたもの (`apps/web/src/lib/preview-name.ts`。例: `feat/worker-previews` → `feat-worker-previews`)。同じブランチにプッシュすると、そのプレビューが更新される。複数のブランチを同時に見られる。
- **Durable Objects** は、プレビューごとに別の名前空間が自動で作られる。
- **D1、R2、キュー**は、何も指定しないと本番と共有されてしまうので、`wrangler.jsonc` の `previews` ブロックで、プレビュー用のものを指定している。**D1 と R2 は全プレビューで 1 つを共有する** (データも共有)。列の削除や名前の変更を含むブランチを出すと、他のブランチのプレビューが壊れることがある。壊れたら、プレビュー用の DB を作り直す。
- **ログイン:** ログインは `BETTER_AUTH_URL` と同じオリジンからのリクエストしか受け付けない。プレビューごとに URL が違うので、`scripts/deploy-preview.sh` が、`wrangler preview --name <プレビュー名> --var BETTER_AUTH_URL:<そのプレビューの URL>` で、プレビューごとに渡している。
- **メール:** キューを取り出す側 (コンシューマ) と cron は、プレビューでは動かない (Cloudflare の制約)。プレビューでは、メールは送られない。
- 1 つの Worker に、プレビューは 100 個まで (無料プラン)。超えると、古いものから自動で削除される。手で消すときは `wrangler preview delete --name <プレビュー名>`。
- Worker Previews はオープンベータ (2026 年 9 月に公開)。

手元からプレビューを作る: `pnpm deploy:preview` (いまのブランチを、そのブランチ名のプレビューにする)。

**参考: バージョン URL は使えない。** Cloudflare には、`wrangler versions upload` で作る「バージョン URL」(`<ハッシュ>-kanban-web…`) という別の仕組みもあるが、Durable Objects を持つ Worker では作られない (実際に試して、開けないことを確認した)。

## 3. 設定値とシークレット

| 名前                                        | どこに                                                                                | 内容                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | web のシークレット (本番)、プレビューの base config のシークレット (全プレビュー共通) | 長いランダム文字列。本番とプレビューで別の値                                 |
| `BETTER_AUTH_URL`                           | web の `vars` (本番)。プレビューは `scripts/deploy-preview.sh` が渡す                 | 公開 URL。ログインのオリジン確認に使う                                       |
| `RESEND_API_KEY`                            | reminder-worker のシークレット                                                        | Resend の API キー ([ワーカー仕様](worker.md))                               |
| `REMINDER_FROM`                             | reminder-worker の `vars`                                                             | 送信元アドレス。独自ドメインの検証が要る                                     |
| `APP_URL`                                   | reminder-worker の `vars`                                                             | メールのリンクの先 (本番の公開 URL)                                          |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | web                                                                                   | Google でログインするとき ([#2](https://github.com/ut-code/kanban/issues/2)) |

```sh
cd apps/web
pnpm exec wrangler secret put BETTER_AUTH_SECRET                          # 本番
pnpm exec wrangler preview base-config secret put BETTER_AUTH_SECRET      # 全プレビュー共通
```

シークレットを入れた直後は、反映まで数十秒かかる。そのあいだ、ログインしているのに 401 になるなど、結果が一定しないことがある。少し待ってから試す。

## 4. Workers Builds の設定値 (ダッシュボード)

**`kanban-web`:**

| 設定                          | 値                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Root directory                | `/`                                                                                                                            |
| Build command                 | `pnpm install --frozen-lockfile && pnpm --filter @todo/web build`                                                              |
| Deploy command (`main`)       | `pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db --remote && pnpm --filter @todo/web exec wrangler deploy` |
| Production branch             | `main`                                                                                                                         |
| Non-production branch builds  | 有効                                                                                                                           |
| Non-production deploy command | `./scripts/deploy-preview.sh`                                                                                                  |
| Build watch paths             | `apps/web/**`、`packages/**`、`scripts/**`、`pnpm-lock.yaml`                                                                   |

`scripts/deploy-preview.sh` は、ビルドの環境変数 `WORKERS_CI_BRANCH` からブランチ名を読む。Node で `.ts` を直接動かすので、Node 24 を使う (`.node-version`。Workers Builds も CI もこれに従う)。プレビュー用の D1 にマイグレーションを適用してから、`wrangler preview` でプレビューを作る。

**`kanban-reminder-worker`** (本番だけ):

| 設定              | 値                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Root directory    | `/`                                                                                      |
| Build command     | `pnpm --filter @todo/reminder-worker typecheck` (ビルドの手順はないので、型チェックだけ) |
| Deploy command    | `pnpm --filter @todo/reminder-worker exec wrangler deploy`                               |
| Production branch | `main`                                                                                   |
| Previews          | 無効                                                                                     |

**注意 (はまったところ):**

- 本番のブランチは `main` にする。最初の設定で、本番のブランチが PR のブランチになっていて、PR のプッシュが本番のビルドとして扱われていた。
- `main` 以外のブランチは、「Previews」を有効にして、Preview command に `./scripts/deploy-preview.sh` を入れる。Previews が無効だと、古い方式の「非本番のデプロイ」になり、PR のコメントにプレビューの URL が出ない。
- ブランチの最初のビルドのときに、そのときの設定 (コマンド、トークン) が、そのブランチのプレビュー専用のトリガーに写される。あとから Worker の設定を変えても、既存のブランチには効かない。既存のブランチも直すときは、`cf builds triggers list --external-script-id <プレビューの ID>` でトリガーを見つけて、`cf builds triggers update` で直す (プレビューの ID は `cf workers-builds workers previews list --script-tag <Worker のタグ>` で分かる)。

### 設定を確かめる (`cf`)

ダッシュボードの表示と、実際に保存された値が違うことがあった。Cloudflare の CLI (`cf`) で、保存された値を直接読める。

```sh
npx -y cf auth login                                    # 初回だけ。ブラウザで承認する
export CLOUDFLARE_ACCOUNT_ID=df6c3acd32f66bd1eb95e50607684297
npx -y cf workers scripts search                        # Worker のタグ (内部 ID) を調べる
npx -y cf builds workers get <タグ>                     # 本番のブランチ、コマンド、Previews の有無
npx -y cf builds triggers list --external-script-id <タグ>
npx -y cf builds logs get <ビルドの UUID>               # ビルドのログ
```

## 5. 最初から作り直すとき (参考)

```sh
cd apps/web
pnpm exec wrangler d1 create kanban-db
pnpm exec wrangler d1 create kanban-db-preview
pnpm exec wrangler r2 bucket create kanban-files
pnpm exec wrangler r2 bucket create kanban-files-preview
pnpm exec wrangler queues create kanban-reminders
pnpm exec wrangler queues create kanban-notifications
pnpm exec wrangler queues create kanban-mail-dead-letter
pnpm exec wrangler queues create kanban-notifications-preview
```

できた `database_id` を、`apps/web/wrangler.jsonc` (本番と `previews`)、`apps/web/wrangler.preview-migrations.jsonc`、`apps/reminder-worker/wrangler.jsonc` に書く。そのあと `pnpm db:migrate:remote`、`pnpm db:migrate:preview`、シークレット (3)、`pnpm deploy:web`、`pnpm deploy:worker`。

## 6. 確認すること

- [ ] `main` へのマージで、本番にデプロイされ、マイグレーションが適用される
- [ ] PR のブランチで、`<ブランチ名>-kanban-web.ut-code.workers.dev` にプレビューができ、ログインでき、本番のデータに触れない
- [ ] リマインドの cron が動く (ダッシュボードの Triggers で、実行の履歴を見る)
- [ ] メールが届く ([ワーカー仕様](worker.md) の「未了」)
- [ ] デッドレターキュー (`kanban-mail-dead-letter`) に、送れなかったメールが溜まっていない

## 設定を変えたとき

`pnpm check:deploy` で、`apps/web` と `apps/reminder-worker` の設定が、まだ正しく読めることを確かめる (アップロードはしない)。CI の `check` ジョブでも実行する。
