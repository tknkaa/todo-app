# Todo App

TanStack Start on Cloudflare Workers, with D1, R2, Durable Objects, and a reminder worker.

## Local development

```sh
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm db:migrate:local
pnpm dev
```

`pnpm dev` builds the app and starts it in Wrangler's local Workers runtime so the D1 binding is available. Edit `apps/web/.dev.vars` to set the local demo user's email.

The task API currently uses the configured demo user until authentication is implemented. Do not expose this demo setup as a multi-user production deployment.
