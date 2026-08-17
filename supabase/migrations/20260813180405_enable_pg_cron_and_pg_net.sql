-- Already applied on sanctuary-prod (schema_migrations 20260813180405).
-- This file exists so `supabase db push` matches remote history. Idempotent.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
