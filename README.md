# EDRAM Admin

The internal records and invoicing app for EDRAM Shuttle and Tours. It's an installable web app (PWA) at
**admin.edramshuttle.co.za**, built with React, Vite and TypeScript, with Supabase for sign-in, the database and receipt storage.

The full specification and the decisions behind it are in [`CLAUDE.md`](CLAUDE.md).

> This repository is public. It must never contain customer data, passwords or secret keys.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm run dev
```

Without `.env.local` the app still starts, but the sign-in screen says it isn't connected to a database yet.

## Checks

| Command | What it does |
|---|---|
| `npm test` | Unit tests (money, dates and tax years, phone numbers, invoice maths and status, filters, share text, the invoice PDF) |
| `npm run typecheck` | TypeScript strict-mode check |
| `npm run test:db` | Applies the schema to a throwaway PostgreSQL 16 database and runs the database tests. Needs `PGHOST`/`PGUSER`… pointing at a local Postgres, **never** at Supabase |
| `npm run build` | Production build into `dist/` |

GitHub Actions runs all of them on every pull request. On `main` it also deploys to GitHub Pages.

### Clicking through the app without Supabase

`e2e/flow.cjs` drives the app in headless Chromium against `e2e/fakeSupabase.cjs`, an in-memory stand-in that follows
the same invoice rules as the database. It signs in, adds the fleet, sets bank details, creates a customer and invoice,
issues, shares, records a payment, duplicates and voids, checking each step and saving screenshots and PDFs:

```bash
VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=demo npx vite build --outDir /tmp/edram-e2e
npx vite preview --outDir /tmp/edram-e2e --port 4173 &
node e2e/flow.cjs /tmp/edram-screens       # invoices; ends with: E2E FLOW PASSED
node e2e/expenses.cjs /tmp/edram-screens   # expenses, incl. flight mode; ends with: E2E EXPENSES PASSED
```

It needs Playwright installed globally, so it isn't part of CI. To look at sample PDFs:
`PDF_PREVIEW_DIR=/tmp/pdfs npx vitest run src/lib/pdf/preview.test.ts`.

## Folders

- `src/`: the app (`lib/` holds tested helpers, `features/` holds the screens, `ui/` holds shared pieces)
- `supabase/migrations/`: the database schema, with business rules enforced in the database
- `supabase/tests/`: the database test kit
- `scripts/`: the database test runner and the icon generator
- `e2e/`: the headless click-through and the fake Supabase it runs against
