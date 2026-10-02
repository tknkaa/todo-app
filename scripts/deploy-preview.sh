#!/usr/bin/env bash
# Deploys the current branch as a Worker Preview of kanban-web. Workers Builds runs this for every
# branch other than main ("Non-production branch deploy command"); it also works by hand.
set -euo pipefail

cd "$(dirname "$0")/.."

# Workers Builds tells the branch in WORKERS_CI_BRANCH; by hand, take the checked-out branch.
BRANCH="${WORKERS_CI_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
NAME="$(node scripts/preview-name.ts "$BRANCH")"
URL="https://${NAME}-kanban-web.ut-code.workers.dev"

echo "Preview of ${BRANCH} → ${URL}"

pnpm --filter @todo/web build
# All Previews share one preview database, so this is the same migration step for every branch.
pnpm --filter @todo/web exec wrangler d1 migrations apply kanban-db-preview --remote \
  --config wrangler.preview-migrations.jsonc
# Login only accepts requests from BETTER_AUTH_URL, so give this Preview its own address.
pnpm --filter @todo/web exec wrangler preview --name "$NAME" --var "BETTER_AUTH_URL:${URL}"
