# Trading Journal

A web app for recording and reviewing trades, designed to help traders understand their results, discipline, and trading behavior in one place. Development is organized into four phases, from the core dashboard and data model through analytics, an AI assistant, and deployment.

> **Current status:** Phase 1 is in progress. The project includes a dashboard backed by sample data and an initial Prisma schema. It is not yet connected to a database and does not have authentication or an API.

## Target stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| UI and charts | Components following shadcn/ui patterns, Lucide; Recharts for specialized charts if needed |
| Backend | Spring Boot 3.x for the Core API |
| Database | PostgreSQL; consider TimescaleDB if time-series data volume warrants it |
| AI | Spring AI or LangChain4j for LLM integration; consider Whisper for voice input |
| Testing | JUnit for the backend, Jest or Vitest for the frontend |
| Deployment and observability | Docker, cloud hosting, OpenTelemetry, and Grafana |

The backend, AI, and infrastructure technologies listed above are roadmap targets. They are not installed or enabled in the current starter.

## Getting started

You need a Node.js version supported by Next.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the TypeScript check and create a production build with:

```bash
npm run typecheck
npm run build
```

The Phase 1 dashboard uses demo data, so PostgreSQL is not required to run it.

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

**Already in the starter:** A dashboard and calendar with demo data; KPIs and weekly summaries calculated from the same data set; search across sample pairs and notes; daily reflection details; and an in-page reflection form. An initial Prisma schema is available in `prisma/schema.prisma`.

**Still to do in Phase 1:** Validate the schema against real use cases; choose and set up the Prisma workflow; configure PostgreSQL and migrations; persist trades and journal entries; verify calculations and UX with real data; and add UI states such as loading, empty, and error.

**Exit criteria for Phase 2:** Users can create and view trades and journal entries from the database; the dashboard reflects the selected date range; and the core flows have validation and automated tests.

### Phase 2 — Data & Analytics Engine · Approximately 2 weeks

**Goal:** Replace demo data with real data and calculate verifiable statistics from trade history.

- Build a Core API for CRUD operations on trades and journal entries, with authentication
- Connect Next.js to the API and handle loading, error, validation, and empty-data states
- Implement analytics for win rate, risk-to-reward, maximum drawdown, and daily/weekly P&L
- Define trading-day and timezone rules, realized P&L, partial-close counting, and handling of incomplete data
- Calculate daily/weekly streaks using clearly defined rules, such as consecutive disciplined days or winning days
- Add CSV import for broker statements and validate duplicates and unsupported formats
- Use PostgreSQL as the initial database; evaluate TimescaleDB if data volume or time-series queries justify it

**Exit criteria for Phase 3:** Analytics use clearly defined rules and pass tests; malformed imports are handled safely; and the dashboard uses API results instead of demo data.

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

The current schema is in `prisma/schema.prisma` and is an initial Phase 1 starting point:

- **User:** Owner of trades and journal entries
- **Trade:** Pair, BUY/SELL side, entry/exit prices, lot size, P&L, strategy tag, and open/close times
- **TradingJournal:** Date, notes, emotion score, and screenshot paths/URLs

Before production use, review how prices and monetary values are stored, account currency, timezones, the relationship between trades and journal entries, image storage, and data retention policies.

## Environment variables

A sample connection string is provided in `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trading_journal?schema=public"
```

When database integration begins, copy the example file to `.env` and update it for your local environment. **Never commit `.env` files or real credentials.** `.env.example` is safe to commit as long as it contains no secrets.

## Current project structure

```text
app/                  Next.js App Router page, layout, and styles
lib/mock-data.ts      Dashboard sample data
prisma/schema.prisma  Initial Prisma schema
.env.example          Sample database connection variable
```

## Scope and limitations

- Dashboard data is currently sample data; changing the date range or searching does not query a real database.
- Quick reflections in the starter are temporary in-page state. They are not persisted or associated with a user account.
- There is no API, authentication, CSV import, or AI integration yet.
- This project is a trading journal and a tool for reviewing data. It is not investment advice and does not guarantee profits.
