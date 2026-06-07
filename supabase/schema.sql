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

-- Invite codes that gate signup. An admin generates one from the dashboard; the
-- candidate (or invited teammate) redeems it at /signup along with the email it
-- was issued to. Single-use (used_at) and expiring (expires_at). Accessed only by
-- the service-role server, so RLS stays disabled like the applicants table.
create table if not exists public.invites (
  code         text primary key,
  email        text not null,
  role         text not null default 'candidate',   -- 'candidate' | 'admin'
  applicant_id uuid references public.applicants(id) on delete cascade,  -- null for admin invites
  invited_by   text,                                  -- email of the admin who issued it
  used_at      timestamptz,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites (lower(email));
