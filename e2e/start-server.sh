#!/usr/bin/env bash
# Starts the app for the end-to-end tests: a fresh local database on its own port, so a running
# `pnpm dev` and its data are left alone.
set -euo pipefail

cd "$(dirname "$0")/.."
STATE=.wrangler/e2e-state
PORT=8788

rm -rf "$STATE"
pnpm --filter @todo/web build
pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db --local --persist-to "../../$STATE"
exec pnpm --filter @todo/web exec wrangler dev --local --port "$PORT" --persist-to "../../$STATE" \
  --var BETTER_AUTH_SECRET:e2e-secret-e2e-secret-e2e-secret-1234 \
  --var BETTER_AUTH_URL:"http://localhost:$PORT"
