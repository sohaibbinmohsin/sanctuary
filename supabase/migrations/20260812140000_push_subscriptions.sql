-- Web Push subscriptions for checklist reminders (server-only — not in PowerSync).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_by_org on push_subscriptions (org_id);
create index push_subscriptions_by_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Authenticated users manage their own rows; service_role (sender / edge) bypasses RLS.
create policy push_subscriptions_own on push_subscriptions for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and org_id in (select public.user_org_ids())
  );
