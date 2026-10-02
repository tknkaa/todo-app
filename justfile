# ローカル D1 の保存先（pnpm dev / db:migrate:local と同じ）
state := ".wrangler/state-drizzle-baseline"

# ローカル D1 に SQL を実行する: just sql "select * from tasks"
sql query:
    cd apps/web && pnpm exec wrangler d1 execute todo-db --local --persist-to {{state}} --command "{{query}}"
