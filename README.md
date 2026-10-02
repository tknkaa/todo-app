# Todo App

TanStack Start on Cloudflare Workers, with D1, R2, Durable Objects, and a reminder worker.

The web app uses shadcn/ui components with Tailwind CSS v4. Add or update components from `apps/web` with `pnpm dlx shadcn@latest add <component>`.

Database tables are defined in `packages/db/src/schema.ts`. Generate a migration with `pnpm db:generate`; Wrangler applies the SQL files from `packages/db/migrations` to D1. Cloudflare Worker settings live in `apps/web/wrangler.jsonc` and `apps/reminder-worker/wrangler.jsonc`.

## Docs

- [Architecture](docs/architecture.md)
- Specs: [tasks](docs/specs/tasks.md), [auth](docs/specs/auth.md), [reminders](docs/specs/reminders.md), [database](docs/specs/database.md)
- [Development](docs/development.md)

## Local development

```sh
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm db:migrate:local
pnpm dev
```

`pnpm dev` builds the app and starts it in Wrangler's local Workers runtime so the D1 binding is available. Set `BETTER_AUTH_SECRET` in `apps/web/.dev.vars` to a long random string (`openssl rand -hex 32`). Sign up with email and password in the app; Google OAuth is tracked in a separate issue.

## Inspecting the local database

With [just](https://just.systems) installed: `just sql "select * from tasks"`. Use `pnpm db:migrate:local` to apply migrations.
