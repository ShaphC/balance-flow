create table public.monthly_balance_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.financial_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  starting_balance numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, month_start)
);

create index monthly_balance_overrides_account_month_idx
  on public.monthly_balance_overrides(account_id, month_start);

alter table public.monthly_balance_overrides enable row level security;

create policy "balance overrides own rows"
  on public.monthly_balance_overrides
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
