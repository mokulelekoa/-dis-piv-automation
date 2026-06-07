-- DIS CMOP PIV — Supabase schema
-- Run this once in the Supabase dashboard → SQL Editor.
-- The app uses the service-role key server-side, so RLS is left disabled
-- (no public/anon access). Do not expose the anon key to write paths.

create table if not exists public.applicants (
  id          uuid primary key,
  email       text,
  status      text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists applicants_updated_at_idx on public.applicants (updated_at desc);

-- Private Storage buckets for uploaded form PDFs and profile photos.
insert into storage.buckets (id, name, public)
values ('forms', 'forms', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
