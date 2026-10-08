# Trading Journal

A web app for recording and reviewing trades, designed to help traders understand their results, discipline, and trading behavior in one place. Development is organized into four phases, from the core dashboard and data model through analytics, an AI assistant, and deployment.

> **Current status:** Phase 3 features are implemented in the application code, but PostgreSQL setup and end-to-end verification are still required. The app includes account registration/login, user-scoped APIs, analytics, journal/trade CRUD, CSV import, optional AI journal analysis/history coaching, and reviewed AI quick-log drafts. The database is not bundled with the repository.

## Target stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| UI and charts | Components following shadcn/ui patterns, Lucide; Recharts for specialized charts if needed |
| Backend | Next.js Route Handlers for the current Core API; Spring Boot 3.x remains a possible later extraction |
| Database | PostgreSQL; consider TimescaleDB if time-series data volume warrants it |
| AI | Server-side OpenAI API integration; browser speech recognition for optional dictation |
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

**Analytics rules:** Only trades with both `closedAt` and non-null `pnl` contribute to realized metrics. Win rate counts positive-P&L trades over all realized trades, including breakeven trades in the denominator. Planned R:R is the average target-to-entry distance divided by stop-to-entry distance for realized trades that have both stop-loss and take-profit values; it is not inferred from P&L. Maximum drawdown is the largest peak-to-trough decline in cumulative realized P&L within the requested range, with starting equity set to zero. Winning-day streaks count consecutive trading days with positive net P&L; calendar days without a closed trade are ignored and a zero/loss day breaks the streak. Emotion/P&L correlation is Pearson's r on days with both a saved composure score and realized P&L, only when there are at least three matched days and both values vary; it is descriptive and does not imply causation. Timestamps and weekly grouping use UTC.

**Still required before production:** Configure and verify a real PostgreSQL instance, run migrations, perform authenticated API end-to-end tests, add rate limiting and account recovery/email verification, review the broker-specific CSV formats, and review financial/currency semantics with real account data.

**Exit criteria for Phase 3:** PostgreSQL-backed flows pass end-to-end tests; analytics rules are accepted and verified; and CSV imports are validated against the intended broker statements.

### Phase 3 — AI-Driven Trading Assistant · Approximately 3–4 weeks

**Goal:** Add tools for reflecting on trading behavior and reviewing history without using AI to make trading decisions for the user.

- **Emotion and psychology analysis:** Analyze a saved reflection on explicit request; the model estimates composure from 0 (reactive/off-plan) to 100 (calm/plan-aware). The estimate remains a draft until the user saves the reflection.
- **Emotion/P&L comparison:** Calculate a Pearson correlation for days with both a saved composure score and realized P&L (at least three matched days); this is descriptive, not causal.
- **Pattern recognition and coaching:** On explicit request, send up to 100 closed trades and 40 journal notes from the last year in the selected currency to the configured OpenAI model. AI observations return references to specific supplied records which the UI displays as evidence. This is bounded record retrieval, not embedding/vector-database RAG.
- **Quick log:** Type or dictate trade details, parse them into a draft, then review and edit all values in the normal trade form before saving. Browser speech recognition is optional and depends on browser support.
- **Privacy and safety:** No journal or trade data is sent automatically. Each AI action is user initiated and shows what is sent; only the selected reflection, the typed quick-log text, or the bounded history context is sent. The configured AI provider processes these requests; check its data-handling terms before use. Do not submit secrets or identifying information. AI output is not financial or clinical advice and never places trades.
- **Integration:** Current AI routes use the OpenAI Chat Completions API directly, without an SDK dependency. No Spring AI, LangChain4j, Whisper, or embedding store has been added.

**Implemented:** `/api/ai/emotion`, `/api/ai/coach`, and `/api/ai/quick-log` are authenticated, same-origin mutation routes. They validate inputs and model outputs, cap submitted records/text, enforce a 20-second provider timeout, and report provider/configuration errors without logging private text.

**Still required before production:** Add provider-side and application-side rate/cost limits, measure latency/token usage without retaining user text, verify provider data retention settings, and run authenticated AI/database end-to-end tests. AI integration tests do not make external API calls.

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
- **TradingJournal:** UTC day, notes, optional 0–100 composure score (manual or AI-estimated), and screenshot URLs

Trades and journals are scoped to their owner. Before production use, review money precision, account currency conversion, broker timezone interpretation, image storage, and data retention policies.

## Environment variables

A sample connection string is provided in `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trading_journal?schema=public"
```

Copy the example file to `.env` and update it for your local PostgreSQL instance. **Never commit `.env` files or real credentials.** `.env.example` is safe to commit as long as it contains no secrets.

To enable the optional AI features, add `OPENAI_API_KEY` to the local `.env` file; `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`. Keep the key server-side and never expose it through a `NEXT_PUBLIC_` variable. AI features return a clear configuration error when no key is set.

```env
OPENAI_API_KEY="your-server-side-key"
OPENAI_MODEL="gpt-4o-mini"
```

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
app/api/              Auth, trades, journal, analytics, CSV import, and AI routes
lib/analytics.ts      Pure analytics calculations
lib/ai-assistant.ts   OpenAI request and output validation helpers
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
- AI routes require server-side `OPENAI_API_KEY`; AI tools remain unavailable until it is configured.
- This project is a trading journal and a tool for reviewing data. It is not investment advice and does not guarantee profits.
