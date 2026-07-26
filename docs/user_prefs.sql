-- Cloud sync for personal prefs (GitHub star categories, bookmarks drawer, …).
-- Run once in Supabase → SQL Editor. Each signed-in user owns their own rows.

create table if not exists public.user_prefs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_prefs enable row level security;

-- Each user can only read/write their own preference rows.
drop policy if exists "own prefs" on public.user_prefs;
create policy "own prefs"
  on public.user_prefs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
