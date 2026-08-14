# Cash Flow

Phase 1 foundation for a web-first personal cash-flow tracker using Next.js, TypeScript, Supabase/PostgreSQL, Tailwind CSS, shadcn/ui conventions, and Zod.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable key.
3. Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor.
4. Run `npm install`.
5. Run `npm run dev`.
6. Run `npm test` for deterministic finance tests.

## Decisions

- Signed transaction amounts are the database source of truth; the expense form supplies a positive amount and the domain converts it to negative cash flow.
- Running balances, totals, and ending balances are derived.
- Months normally roll forward from the prior ending balance.
- An intentional starting-balance edit is represented as a balance-anchor override so the discontinuity can be shown and later reconnected.
- Same-date ordering uses `sort_order` while dates remain the primary ordering key.
- Recurrence rules are separate from generated occurrences.
- Privacy Mode changes presentation only and never mutates stored financial data.
- Demo Dataset is intentionally deferred.
