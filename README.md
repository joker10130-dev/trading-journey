# Trading Journal

A web app for recording and reviewing trades, designed to help traders understand their results, discipline, and trading behavior in one place. Development is organized into four phases, from the core dashboard and data model through analytics, an AI assistant, and deployment.

> **Current status:** Phase 2 is implemented in the application code, but PostgreSQL setup and end-to-end verification are still required. The app now includes account registration/login, user-scoped API routes, Prisma migrations, analytics, journal/trade CRUD endpoints, and CSV import. The database is not bundled with the repository.

## Target stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| UI and charts | Components following shadcn/ui patterns, Lucide; Recharts for specialized charts if needed |
| Backend | Next.js Route Handlers for the current Core API; Spring Boot 3.x remains a possible later extraction |
| Database | PostgreSQL; consider TimescaleDB if time-series data volume warrants it |
| AI | Spring AI or LangChain4j for LLM integration; consider Whisper for voice input |
| Testing | JUnit for the backend, Jest or Vitest for the frontend |
| Deployment and observability | Docker, cloud hosting, OpenTelemetry, and Grafana |

Spring Boot, AI, and infrastructure technologies listed as future options are not installed in the current app.

## Getting started

You need a Node.js version supported by Next.js, npm, and a PostgreSQL database.

```bash
npm install
npm run db:migrate
npm run dev
```

Set `DATABASE_URL` in a local `.env` file before running migrations or the app. Open [http://localhost:3000](http://localhost:3000), create an account, and sign in.

Run the TypeScript check and create a production build with:

```bash
npm run typecheck
npm test
npm run build
```

The dashboard and API read/write account data in PostgreSQL. Migration commands require a reachable database.

To create a new migration after changing `prisma/schema.prisma`, run `npm run db:migrate` again. The generated Prisma client is created during `npm install` and production builds.

## Development roadmap

Timelines are estimates for planning and may change as the scope evolves.

### Phase 1 — Core Dashboard & Layout · Approximately 2–3 weeks

**Goal:** Establish the core product structure and UX, along with a data model that can support future development.

- **Dashboard:** Header, date-range presets, search, responsive layout, and dark theme
- **KPIs:** Net P&L, emotion meter, trade win rate, and number of trading days
- **Trading calendar:** Show daily P&L and trade count, distinguish profit and loss days, and open the reflection for a selected day
- **Weekly breakdown:** Summarize P&L and trade count for each week
- **Data model:** Design `User`, `Trade`, and `TradingJournal`
- **UI foundation:** Organize components and layouts for future reuse

**Implemented:** Responsive dashboard and calendar; KPI cards, search, weekly summaries, daily reflection details, and the initial User/Trade/TradingJournal model. The UI has since been connected to the Phase 2 APIs.

**Remaining product work:** Review the schema against real broker/account use cases, refine UI states based on user feedback, and improve accessibility and coverage.

**Exit criteria:** Dashboard and journal workflows are usable, validated, responsive, and covered by tests.

### Phase 2 — Data & Analytics Engine · Approximately 2 weeks

**Goal:** Persist user-owned data and calculate verifiable statistics from trade history.

- Register and sign in with email/password, backed by expiring, hashed database sessions
- Use user-scoped CRUD API routes for trades and journal entries; validate request data and date ranges
- Replace dashboard sample data with API analytics; support date presets, pair/strategy/note search, and currency selection
- Calculate realized P&L, win rate, gross profit/loss, planned R:R from entry/stop/target prices, maximum drawdown, daily/weekly P&L, and winning-day streaks
- Import CSV files up to 2 MB / 5,000 records, validate rows, and skip duplicate external IDs
- Store decimal price/P&L fields in PostgreSQL and use UTC timestamps for trade times and journal-day boundaries
- Use PostgreSQL as the initial database; evaluate TimescaleDB only if data volume or query patterns justify it

**Implemented in the codebase:** Next.js Route Handlers are used as the Core API for this starter. Authentication routes are `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`. Data routes include `/api/trades`, `/api/trades/:id`, `/api/journals`, `/api/journals/:id`, `/api/analytics`, and `/api/import/csv`. Schema and initial migration are in `prisma/`.

**Analytics rules:** Only trades with both `closedAt` and non-null `pnl` contribute to realized metrics. Win rate counts positive-P&L trades over all realized trades, including breakeven trades in the denominator. Planned R:R is the average target-to-entry distance divided by stop-to-entry distance for realized trades that have both stop-loss and take-profit values; it is not inferred from P&L. Maximum drawdown is the largest peak-to-trough decline in cumulative realized P&L within the requested range, with starting equity set to zero. Winning-day streaks count consecutive trading days with positive net P&L; calendar days without a closed trade are ignored and a zero/loss day breaks the streak. Timestamps and weekly grouping use UTC.

**Still required before production:** Configure and verify a real PostgreSQL instance, run migrations, perform authenticated API end-to-end tests, add rate limiting and account recovery/email verification, review the broker-specific CSV formats, and review financial/currency semantics with real account data.

**Exit criteria for Phase 3:** PostgreSQL-backed flows pass end-to-end tests; analytics rules are accepted and verified; and CSV imports are validated against the intended broker statements.

### Phase 3 — AI-Driven Trading Assistant · Approximately 3–4 weeks

**Goal:** Add tools for reflecting on trading behavior and reviewing history without using AI to make trading decisions for the user.

- **Emotion and psychology analysis:** Summarize sentiment or emotions from journal notes and compare them with trading outcomes
- **Pattern recognition and coaching:** Analyze historical trends, such as performance by day, strategy, or user-recorded time period
- **RAG assistant:** Retrieve relevant context from the user's trades and journal, cite it in responses, and show the data behind observations
- **Quick log:** Let users type or speak trade details, convert them into structured data, and review the result before saving
- Use Spring AI or LangChain4j as the LLM integration layer; evaluate Whisper for speech-to-text
- Design for consent, data minimization, financial-data protection, and clear communication when analysis is uncertain
- Distinguish calculated facts from AI-generated observations; do not promise returns or place trades on the user's behalf

**Exit criteria for Phase 4:** AI responses reference relevant data; users can review and correct AI-extracted details before saving; and basic error handling, latency, and cost tracking are in place.

### Phase 4 — AI-Assisted Workflow & Infrastructure · Approximately 2 weeks

**Goal:** Make development, testing, and deployment workflows repeatable.

- Use AI pair-programming tools for refactoring, boilerplate, and tests, with changes reviewed before merging
- Add unit and integration tests: JUnit for the API and Jest/Vitest for the UI, depending on the selected tooling
- Create Docker images and a local development setup for the frontend, backend, and PostgreSQL
- Configure CI for linting, type checking, tests, and builds
- Deploy the frontend and backend to suitable hosting and manage secrets through environment variables
- Add OpenTelemetry/Grafana for API performance and error monitoring
- Track LLM latency and token usage without logging journal notes or other sensitive data
- Prepare database backup and restore procedures, migrations, and a release checklist before launch

**Production readiness criteria:** Deployments are repeatable through a pipeline; secrets are not stored in source control; health checks and monitoring are available; and database recovery has been tested.

## Initial data model

The current schema is in `prisma/schema.prisma`, with migration history in `prisma/migrations/`:

- **User:** Account owner, normalized unique email, and password hash
- **Session:** Hashed random session token and expiry, linked to one account
- **Trade:** Pair, BUY/SELL side, entry/exit, stop-loss and take-profit prices, lot size, realized P&L, currency, strategy tag, external import ID, and open/close times
- **TradingJournal:** UTC day, notes, optional emotion score, and screenshot URLs

Trades and journals are scoped to their owner. Before production use, review money precision, account currency conversion, broker timezone interpretation, image storage, and data retention policies.

## Environment variables

A sample connection string is provided in `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trading_journal?schema=public"
```

Copy the example file to `.env` and update it for your local PostgreSQL instance. **Never commit `.env` files or real credentials.** `.env.example` is safe to commit as long as it contains no secrets.

## CSV import format

The authenticated `POST /api/import/csv` endpoint accepts multipart form data with a `file` field. Required headers are `pair`, `side`, `entryPrice`, `lotSize`, and `openedAt`. Optional headers include `ticket` (or `tradeId`), `exitPrice`, `stopLoss`, `takeProfit`, `pnl` (also accepts `P&L`), `currency`, `strategyTag`, and `closedAt`. Timestamps should include a timezone; normalize broker exports to UTC before importing. Rows with an external ticket ID are deduplicated per user; exports without one receive a deterministic fingerprint.

Example:

```csv
ticket,pair,side,entryPrice,exitPrice,stopLoss,takeProfit,lotSize,pnl,currency,strategyTag,openedAt,closedAt
broker-123,EURUSD,BUY,1.08000,1.08250,1.07800,1.08500,0.50,125.00,USD,London breakout,2026-03-02T09:00:00Z,2026-03-02T10:15:00Z
```

## Current project structure

```text
app/                  Next.js App Router page, layout, and styles
app/api/              Auth, trades, journal, analytics, and CSV import routes
lib/analytics.ts      Pure analytics calculations
lib/csv-import.ts     CSV parsing and validation
lib/auth.ts           Database-backed session helpers
prisma/schema.prisma  PostgreSQL data model
prisma/migrations/    Initial SQL migration
.env.example          Sample database connection variable
```

## Scope and limitations

- A PostgreSQL server is required to register/sign in or use the dashboard APIs; database-backed end-to-end behavior could not be verified without a running database.
- Account authentication is a starter implementation. Add abuse controls, account recovery, email verification, and operational session cleanup before exposing it publicly.
- The analytics currency selector reports P&L within one currency at a time. It does not convert between currencies.
- CSV timestamp conventions depend on the source broker; normalize to UTC and verify imported values before relying on analytics.
- AI integration is planned for Phase 3 and is not available yet.
- This project is a trading journal and a tool for reviewing data. It is not investment advice and does not guarantee profits.
