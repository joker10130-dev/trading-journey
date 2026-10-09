# Copilot instructions for trading-journey

## Project snapshot

This is a Next.js 16 App Router app for a trading journal/dashboard. The app persists user accounts, trades, journal entries, and sessions in PostgreSQL via Prisma. The repo also includes optional OpenTelemetry/metrics setup, Docker compose for local dev, and Vitest coverage for validation/analytics logic.

This project has a few repo-specific quirks: the generated Prisma client lives under `generated/prisma`, server-side auth is cookie-based, and the project has explicit `next`-specific guidance in the root `AGENTS.md` file. Treat the repo as a direct server-side app, not as a generic SaaS template.

## Build, test, and lint commands

Use the existing npm scripts defined in `package.json`:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Database and Prisma checks that are part of the project workflow:

```bash
npm run db:migrate
npm run db:deploy
npx prisma validate
```

Run a single file/test directly with Vitest:

```bash
npm test -- --run lib/validation.test.ts
npm test -- --run lib/analytics.test.ts
# or
npx vitest run lib/validation.test.ts
```

The CI workflow is the authoritative check set and runs:

```bash
npm run lint
npm run typecheck
npm test
npx prisma validate
npm run db:deploy
npm run build
npm audit --audit-level=high
```

## High-level architecture

- `app/` is the App Router entrypoint. Route handlers live under `app/api/*/route.ts`, and the home page redirects authenticated users to `/dashboard` or unauthenticated users to `/login`.
- `lib/` contains the shared server logic: authentication, API middleware, request/response helpers, validation schemas, Prisma access, and analytics computation.
- `prisma/schema.prisma` defines the data model: `User`, `Trade`, `TradingJournal`, and `Session`. Use Prisma for all DB access and keep user-scoped queries anchored to `userId`.
- `lib/validation.ts` is the central input-validation layer for trade/journal/auth payloads and should be extended whenever request shapes change.
- `lib/analytics.ts` computes KPI/aggregate values (net P&L, win rate, daily/weekly summaries, drawdown, emotion correlation) used by the dashboard. Keep the existing summary types and JSON shapes stable when changing the metrics layer.
- `monitoring/` and the OpenTelemetry config in `compose.observability.yaml` are optional operational tooling; avoid broad architectural changes there unless you are specifically working on observability.
- Local Docker setup is defined in `compose.yaml` and `Dockerfile`; use it for postgres + app bootstrapping, not as a substitute for application code changes.

## Key conventions specific to this repo

- Use Zod for request validation and shape enforcement, especially in API routes and auth flows. Do not add ad hoc parameter checks that bypass the existing schemas.
- API routes generally follow this pattern: same-origin enforcement, `requireApiUser()`, `parseJson()`, Prisma mutation, then a structured `NextResponse.json(...)` response. Preserve the existing `apiError(...)` and error-code conventions.
- Do not bypass auth. The app stores a signed session cookie (`tj_session`) and validates it against a hashed token in `lib/auth.ts` and the `Session` table.
- Database values are generally expected to be UTC-based for trade dates and journal day boundaries. When filtering ranges, use explicit UTC date boundaries and preserve the repo's `Date`/ISO conventions.
- Decimal financial values are represented as Prisma `Decimal` in the schema and converted to numbers when serializing JSON responses. Keep that conversion pattern when returning trade data from API handlers.
- Respect per-user data isolation. Most reads/writes should include `where: { userId: auth.user.id }` or the equivalent Prisma relation scoping.
- The generated Prisma client is intentionally emitted to `generated/prisma`; do not hand-edit generated output or change the generator configuration casually.
- The repo’s root `AGENTS.md` contains a Next.js-specific warning with a strong recommendation to consult `node_modules/next/dist/docs` before making routing or server-runtime changes, because this version has breaking changes relative to older Next.js conventions.
- CI enforces lint, typecheck, tests, Prisma validation, deploy migration, production build, and npm audit. Prefer making changes that pass this same local verification flow before finishing work.

## Working style for this repository

- Keep changes small and aligned with the existing patterns in the nearest feature area (`app/api`, `lib`, or `prisma`).
- Prefer extending `lib/validation.ts` and existing route handlers instead of introducing a parallel validation system.
- When you touch analytics or trade data, continue to use the repo's existing DTOs and calculations in `lib/analytics.ts` so dashboard behavior stays consistent.
- If you add or change a database model, update the Prisma schema and evaluate the migration workflow (`npm run db:migrate` for local dev, `npm run db:deploy` for committed environments).

## Local environment notes

- Set `DATABASE_URL` in a local `.env` before running migrations or starting the app.
- Optional AI features require `OPENAI_API_KEY` in `.env` if you want to enable those routes and telemetry.
- `npm install` triggers Prisma generation via `postinstall`, and `npm run build` also runs `prisma generate` before the Next.js production build.
