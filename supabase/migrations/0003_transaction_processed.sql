alter table public.transactions
  add column if not exists processed boolean not null default false;