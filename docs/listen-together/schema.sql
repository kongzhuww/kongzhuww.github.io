-- "好友在听" board table.
-- Run this in Supabase → SQL Editor once.

create table if not exists public.now_playing (
  handle       text primary key,   -- unique id per person, e.g. "kong"
  display_name text,
  title        text,
  artist       text,
  album        text,
  cover        text,               -- image url or data: URI
  status       text,               -- "playing" | "paused" | "stopped"
  position_ms  bigint,
  duration_ms  bigint,
  app          text,               -- source app, e.g. "网易云"
  updated_at   timestamptz not null default now()
);

alter table public.now_playing enable row level security;

-- Anyone may READ the board (it is a public "friend activity" feed).
drop policy if exists "now_playing public read" on public.now_playing;
create policy "now_playing public read"
  on public.now_playing for select
  using (true);

-- No anon INSERT/UPDATE policy: all writes go through the `now-playing`
-- Edge Function using the service-role key (which bypasses RLS).

-- Table-level grants: the Edge Function writes as service_role; the website
-- reads as anon. (Without these you get "permission denied for table".)
grant all privileges on table public.now_playing to service_role;
grant select on table public.now_playing to anon, authenticated;

-- Enable Realtime so the website updates live.
alter publication supabase_realtime add table public.now_playing;
