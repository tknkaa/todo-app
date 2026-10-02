# ローカル D1 の保存先（pnpm dev / db:migrate:local と同じ）
state := ".wrangler/state-drizzle-baseline"

default:
    @just --list

# ローカル D1 に SQL を実行する: just sql "select * from users"
sql query:
    cd apps/web && pnpm exec wrangler d1 execute todo-db --local --persist-to {{state}} --command "{{query}}"

# タスク一覧
tasks:
    @just sql "select id, user_id, title, due_at, completed_at from tasks order by created_at desc"

# ユーザー一覧
users:
    @just sql "select id, email, name, created_at from users"

# テーブル一覧
tables:
    @just sql "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'"

# マイグレーションを適用する
migrate:
    pnpm db:migrate:local
