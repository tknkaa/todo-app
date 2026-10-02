# 開発

## セットアップ

```sh
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # BETTER_AUTH_SECRET を設定する
pnpm db:migrate:local
pnpm dev                                           # http://localhost:8787
```

`pnpm dev` はアプリをビルドして、Wrangler のローカルの Workers 環境で起動する (D1 などの binding を使うため)。

## チェックとテスト

```sh
pnpm check   # フォーマット、lint、型チェック、テストをまとめて実行
```

| コマンド                            | 内容                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm format` / `pnpm format:check` | Oxfmt                                                                                                |
| `pnpm lint`                         | Oxlint                                                                                               |
| `pnpm typecheck`                    | TypeScript (`apps/web` はビルドも行う)                                                               |
| `pnpm test`                         | Vitest (`apps/web`、`apps/reminder-worker`、`packages/db`)                                           |
| `pnpm test:e2e`                     | Playwright。本物のブラウザでアプリを動かす (下を参照)                                                |
| `pnpm check:deploy`                 | Wrangler の設定 (Web とメールの Worker) が読めることの確認 (アップロードなし。[デプロイ](deploy.md)) |

CI (`.github/workflows/ci.yml`) は、PR と main への push で、`check` (`pnpm check` と `pnpm check:deploy`) と `e2e` (`pnpm test:e2e`) の 2 つのジョブを実行する。E2E は遅く不安定になりやすいので、速いチェックの結果を隠さないよう、別のジョブにしている。

## テストの方針

- **純粋な関数** (`apps/web/src/lib/`): ユニットテスト。入力と出力だけを確認する。
- **HTTP ハンドラ・リポジトリ**: インメモリ SQLite (`@todo/db/testing`、Node の `node:sqlite`) に本物のマイグレーションを適用して確認する。D1 固有の挙動は確認できない。

## E2E テスト

`e2e/tests/` のテストを、Playwright で、本物の Chrome に動かしてもらう。`pnpm test:e2e` で実行する。

- Google Chrome がインストールされている必要がある (GitHub Actions の Ubuntu には入っている。ブラウザのダウンロードはしない)。
- テストの前に、`e2e/start-server.sh` が、**空のローカル DB** と別のポート (8788) でアプリを起動する。起動中の `pnpm dev` とそのデータには触れない。`.wrangler/e2e-state` に保存し、毎回消す。
- 各テストが自分でアカウントを作る (`signUp`)。メールアドレスは毎回違うので、テストは互いのデータに依存せず、並行して動く。
- スマホの画面は、`phone` プロジェクト (`mobile.spec.ts`、Pixel 7) で確認する。

何を書くか:

- 画面が変わっても変わりにくい**主な流れ**だけを確かめる: ログイン、タスクの追加と移動、詳細ページ、本文の保存と競合、添付、共有 (2 人)、スマホで崩れないこと。
- 文言やボタンの配置ではなく、役割とラベル (`getByRole`、`getByLabel`) で要素を探す。
- カードをどこに落とすとどの順に並ぶか、のような細かい挙動は、ユニットテスト (`lib/order.ts`) に任せる。
- 操作のあとの状態は、`expect.poll` や `expect(...).toBeVisible()` で待つ。待たずに読むと不安定になる。

## ブランチと PR

小さな PR に分け、`gh stack` で積み上げる。マージは squash。
