-- Migration 0002 : Snapshot temps reel atomique pour synchronisation 40-100 appareils (Vercel + Supabase Realtime)
-- Lecture publique autorisee via RLS pour le videoprojecteur /live et les telephones,
-- ecriture STRICTEMENT reservee a la route API serveur `/api/tournament/state` (service_role + Zod + anti-CSRF + guards).

create table if not exists public.tournament_live_snapshots (
  id text primary key,
  revision bigint not null default 1,
  state_json jsonb not null,
  last_event_json jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tournament_live_snapshots enable row level security;

drop policy if exists "Public read tournament live snapshots"
  on public.tournament_live_snapshots;

create policy "Public read tournament live snapshots"
  on public.tournament_live_snapshots
  for select
  to anon, authenticated
  using (true);

-- Aucune policy INSERT / UPDATE / DELETE publique :
-- toute mutation passe obligatoirement par /api/tournament/state (validation Zod + verrous + requireAdmin).

do $$
begin
  alter publication supabase_realtime add table public.tournament_live_snapshots;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
