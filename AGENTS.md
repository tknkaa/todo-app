# AGENTS.md

Todo アプリ。Cloudflare Workers 上の TanStack Start (`apps/web`) と、メールを送る Worker (`apps/reminder-worker`。cron のリマインドと、共有の通知)。データは D1 (Drizzle)、ファイルは R2、リアルタイム通知は Durable Objects。仕様と構成は `docs/` にある。まず `docs/architecture.md` を読む。

## コマンド

```sh
pnpm check                 # フォーマット、lint、型チェック、テスト。PR の前に必ず通す
pnpm test:e2e              # 本物のブラウザでの E2E (Chrome が必要。空の DB で別のポート 8788 に起動する)
pnpm format                # Oxfmt で整形
pnpm test                  # Vitest (apps/web、apps/reminder-worker、packages/db)
pnpm check:deploy          # Wrangler の設定 (Web とメールの Worker) が読めることの確認。アップロードはしない
pnpm db:generate --name=<内容が分かる名前>   # マイグレーションを生成
pnpm db:migrate:local      # ローカルの D1 に適用
pnpm dev                   # ビルドして wrangler dev (http://localhost:8787)
just sql "select * from tasks"   # ローカルの D1 を見る
```

- `pnpm dev` はビルド済みの `dist/` を動かす。コードを変えたら `pnpm --filter @todo/web build` をやり直す。
- ローカルの設定は `apps/web/.dev.vars` (`BETTER_AUTH_SECRET` が必須。`.dev.vars.example` を参照)。

## 構成

- `apps/web/src/lib/`: 純粋な関数 (入力検証、整形、ステータス、リマインドのルールなど)。**新しい純粋な関数はここに置き、必ずテストを書く。**
- `apps/web/src/server/`: HTTP ハンドラ。依存 (リポジトリ、R2、通知) は引数で受け取り、テストでは差し替える。
- `apps/web/src/components/`, `routes/`, `hooks/`: 画面。
- `packages/db`: Drizzle のスキーマ、マイグレーション、D1 リポジトリ、共有する型。パッケージは増やさない (`domain` や `application` に戻さない)。
- `docs/`: 仕様と手順 (デプロイは `docs/deploy.md`)。**挙動、API、テーブル、設定を変えたら、同じ PR で docs も更新する。**

## テスト

- ハンドラとリポジトリは、インメモリ SQLite (`@todo/db/testing`) に本物のマイグレーションを適用して試す。
- 新しい機能には、正常系に加えて、他のユーザーが触れないこと (所有者と共有された人だけが扱えること) のテストを書く。
- 画面を通した主な流れは、E2E テスト (`pnpm test:e2e`、Playwright) で確かめる。UI は変わっていくので、E2E は主な流れだけにし、文言や配置ではなく役割とラベルで要素を探す。細かい挙動はユニットテストに任せる。詳しくは `docs/development.md`。
- 画面を変えたら、E2E に加えて、実際に動かして見た目も確かめる。

## データベース

- マイグレーションの名前は内容が分かるものにする (`0003_add_task_attachments` のように)。
- 適用済みのマイグレーションは書き換えない。直すときは新しいマイグレーションを足す。
- 既存の行に影響する変更は、バックフィルの SQL を足して、実際に確かめる。
- SQLite の `strftime('%s', …)` は文字列を返す。数値と比べるときは `cast(… as integer)` にする。

## 権限

- タスクを見たり、タイトル・締め切り・ステータス・本文を変えたり、並べ替えたりできるのは、所有者と共有された人。
- 削除、リマインドの設定、添付ファイル、共有の操作は所有者だけ。
- 他のユーザーのものには 404 を返し、存在を知らせない。
- 共有の API は、メールアドレスにアカウントがあるかどうかを答えない。ないアドレスは「招待」として保存し、アカウントができたときに共有する。同じ応答、同じ形の一覧にする。
- 本文の保存は、読み込んだ版 (`descriptionVersion`) を付けて送り、古ければ 409 で断る。他の人の本文を黙って上書きしない。
- R2 のキー (`r2Key`) は API で返さない。
- 添付のダウンロードは常に `Content-Disposition: attachment` と `nosniff` を付ける。

## 守ること

- **Worker のエントリ (`apps/web/src/server.tsx`) の export は `default` と `CollaborationRoom` だけにする。** Workers は export をすべてハンドラかクラスとして扱う。`vite.config.ts` の `preserveEntrySignatures: 'strict'` を外さない。
- WebSocket の `close()` に、1005 と 1006 は渡せない (`replyCloseCode` を使う)。
- ドラッグ中のカードは、`display: none` にしない (Chrome がドラッグを取り消す)。高さを 0 にもしない (下のカードが動いてページの高さが縮み、ポインタの下にあるものがずれて、ドロップが外れる)。`opacity-0` で、場所を保ったまま見えなくする。
- Tailwind では、`p-3.5` と `p-0` のように、同じ項目のクラスを両方付けない。優先は定義順で決まる。条件で丸ごと切り替える。
- 色は白・灰・黒だけ。`--destructive` の赤は、エラーと削除にだけ使う。

## 進め方

- 変更は小さな PR に分け、`gh stack` で積み上げる。マージは squash。
- ブランチ名は `feat/…`、`fix/…`、`docs/…`。コミットと PR のタイトルは `feat: …` のように種類で始める。
- 画面の文言、docs、issue は日本語で書く。
- やり残しは issue にする。
