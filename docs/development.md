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

| コマンド                            | 内容                                   |
| ----------------------------------- | -------------------------------------- |
| `pnpm format` / `pnpm format:check` | Oxfmt                                  |
| `pnpm lint`                         | Oxlint                                 |
| `pnpm typecheck`                    | TypeScript (`apps/web` はビルドも行う) |
| `pnpm test`                         | Vitest (`apps/web`、`packages/db`)     |

CI (`.github/workflows/ci.yml`) は、PR と main への push で `pnpm check` を実行する。

## テストの方針

- **純粋な関数** (`apps/web/src/lib/`): ユニットテスト。入力と出力だけを確認する。
- **HTTP ハンドラ・リポジトリ**: インメモリ SQLite (`@todo/db/testing`、Node の `node:sqlite`) に本物のマイグレーションを適用して確認する。D1 固有の挙動は確認できない。

## ブランチと PR

小さな PR に分け、`gh stack` で積み上げる。マージは squash。
