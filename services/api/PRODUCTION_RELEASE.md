# Production release gate

1. Take and verify a PostgreSQL backup, including the migration table.
2. In a one-off release job, run `pnpm --filter @titanstream/api exec prisma migrate deploy` against the production database. Do not use `prisma db push` or `--accept-data-loss`.
3. Confirm `GET /api/v1/health/readiness` returns `READY` and that ledger accounts `PLATFORM_RESERVE` and `USER_ASSET_LIABILITY` are present.
4. Deploy the API, then the web build with `VITE_API_BASE_URL` set to the API origin.
5. Smoke-test Telegram auth, admin Telegram login, global USDT funding, East Africa mobile-money funding, card rejection, ownership checks, and an idempotent purchase/withdrawal retry.
6. Roll back the application image before attempting any database rollback. Restore a database backup only through the approved incident procedure.

The database migration history in this repository predates a complete initial
schema migration. Before first deployment to a new empty production database,
create and rehearse a baseline migration from a verified staging clone. Do not
try to bootstrap it during application startup.
