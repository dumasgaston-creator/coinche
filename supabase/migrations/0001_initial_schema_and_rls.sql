-- ============================================================================
-- Coinch'Eirb - Migration 0001 : Schema Temps Reel Complet & Politiques RLS
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Types enumeres metier
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('player', 'admin');

create type public.tournament_status as enum (
  'draft',
  'checkin',
  'pools',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'final',
  'completed'
);

create type public.match_phase as enum (
  'pool',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'final'
);

create type public.match_status as enum (
  'pending',
  'in_progress',
  'completed',
  'forfeit',
  'bye'
);

create type public.announcement_type as enum (
  'capot',
  'generale',
  'coinche',
  'surcoinche'
);

create type public.announcement_outcome as enum (
  'pending',
  'passed',
  'failed'
);

create type public.live_popup_phase as enum (
  'announced',
  'passed',
  'failed'
);

create type public.referee_alert_type as enum (
  'referee_call',
  'abandon_request'
);

create type public.referee_alert_status as enum (
  'open',
  'acknowledged',
  'resolved'
);

-- ----------------------------------------------------------------------------
-- 2. Tables principales
-- ----------------------------------------------------------------------------

-- Table 1 : Profils utilisateurs (Admin et comptes joueurs optionnels)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null check (char_length(trim(display_name)) between 2 and 60),
  role public.user_role not null default 'player',
  school_year text not null default '2026-2027',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 2 : Tournois (soirees Coinch'Eirb)
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(trim(title)) between 3 and 120),
  event_date date not null,
  starts_at timestamptz not null,
  school_year text not null default '2026-2027',
  status public.tournament_status not null default 'checkin',
  registrations_locked boolean not null default false,
  player_score_editing_enabled boolean not null default true,
  round_of_16_threshold integer not null default 12 check (round_of_16_threshold between 8 and 32),
  deals_per_pool_match integer not null default 5 check (deals_per_pool_match between 1 and 15),
  target_score_r16 integer not null default 500 check (target_score_r16 > 0),
  target_score_qf integer not null default 600 check (target_score_qf > 0),
  target_score_sf integer not null default 700 check (target_score_sf > 0),
  target_score_final integer not null default 1000 check (target_score_final > 0),
  poster_storage_path text,
  poster_public_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 3 : Poules generees
create table public.pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pool_number integer not null check (pool_number >= 1),
  pool_label text not null check (char_length(trim(pool_label)) between 1 and 40),
  size integer not null check (size between 3 and 6),
  assigned_table_start integer not null check (assigned_table_start >= 1),
  total_points_scored integer not null default 0 check (total_points_scored >= 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, pool_number)
);

-- Table 4 : Equipes inscrites (sans secret d'acces pour permettre le Realtime public sans fuite)
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null check (char_length(trim(team_name)) between 2 and 60),
  normalized_name text not null check (char_length(trim(normalized_name)) between 2 and 60),
  player_1_name text not null check (char_length(trim(player_1_name)) between 2 and 60),
  player_2_name text not null check (char_length(trim(player_2_name)) between 2 and 60),
  player_1_profile_id uuid references public.profiles(id) on delete set null,
  player_2_profile_id uuid references public.profiles(id) on delete set null,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  is_forfeit boolean not null default false,
  pool_id uuid references public.pools(id) on delete set null,
  seed_order integer check (seed_order is null or seed_order >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, normalized_name)
);

-- Table 5 : Secrets d'acces rapide par equipe (isolee, Admin / Serveur uniquement)
create table public.team_secrets (
  team_id uuid primary key references public.teams(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  access_code_hash text not null,
  access_code_hint text not null check (char_length(access_code_hint) between 4 and 12),
  updated_at timestamptz not null default now()
);

-- Table 6 : Appartenance et statistiques de poule
create table public.pool_memberships (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  position_in_pool integer not null check (position_in_pool >= 1),
  matches_played integer not null default 0 check (matches_played >= 0),
  matches_won integer not null default 0 check (matches_won >= 0),
  matches_lost integer not null default 0 check (matches_lost >= 0),
  points_scored integer not null default 0 check (points_scored >= 0),
  points_conceded integer not null default 0 check (points_conceded >= 0),
  pool_rank integer check (pool_rank is null or pool_rank >= 1),
  qualified boolean not null default false,
  qualification_reason text check (
    qualification_reason is null
    or qualification_reason in ('direct_top_n', 'best_wildcards', 'eliminated', 'forfeit')
  ),
  unique (pool_id, team_id),
  unique (tournament_id, team_id)
);

-- Table 7 : Matchs (poules et tableau a elimination directe)
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  phase public.match_phase not null,
  pool_id uuid references public.pools(id) on delete cascade,
  round_number integer not null default 1 check (round_number >= 1),
  bracket_slot integer check (bracket_slot is null or bracket_slot >= 1),
  table_number integer check (table_number is null or table_number >= 1),
  team_a_id uuid references public.teams(id) on delete restrict,
  team_b_id uuid references public.teams(id) on delete restrict,
  score_team_a integer not null default 0 check (score_team_a >= 0),
  score_team_b integer not null default 0 check (score_team_b >= 0),
  target_score integer check (target_score is null or target_score > 0),
  max_deals integer check (max_deals is null or max_deals >= 1),
  deals_played integer not null default 0 check (deals_played >= 0),
  is_direct_final_score boolean not null default false,
  status public.match_status not null default 'pending',
  winner_team_id uuid references public.teams(id) on delete set null,
  forfeit_team_id uuid references public.teams(id) on delete set null,
  locked_by_admin boolean not null default false,
  next_match_id uuid references public.matches(id) on delete set null,
  next_match_slot text check (next_match_slot is null or next_match_slot in ('team_a', 'team_b')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_by_role text check (updated_by_role is null or updated_by_role in ('team', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 8 : Detail des donnes saisies par match
create table public.match_deals (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  deal_number integer not null check (deal_number between 1 and 30),
  points_team_a integer not null check (points_team_a between 0 and 2500),
  points_team_b integer not null check (points_team_b between 0 and 2500),
  is_tiebreaker_deal boolean not null default false,
  special_announcement public.announcement_type,
  announcement_outcome public.announcement_outcome,
  parlante_penalty boolean not null default false,
  recorded_by_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, deal_number)
);

-- Table 9 : File d'annonces temps reel pour pop-ups GSAP sur /live
create table public.live_announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  table_number integer not null check (table_number >= 1),
  team_id uuid references public.teams(id) on delete cascade,
  team_name_snapshot text not null check (char_length(trim(team_name_snapshot)) between 1 and 60),
  announcement_type public.announcement_type not null,
  phase public.live_popup_phase not null default 'announced',
  points_awarded integer check (points_awarded is null or points_awarded >= 0),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Table 10 : Alertes arbitre et demandes d'abandon en direct vers /admin
create table public.referee_alerts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  table_number integer not null check (table_number >= 1),
  requesting_team_id uuid references public.teams(id) on delete set null,
  alert_type public.referee_alert_type not null,
  message text check (message is null or char_length(message) <= 280),
  status public.referee_alert_status not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Table 11 : Classement general annuel Coinch'Eirb
create table public.annual_leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  school_year text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name_snapshot text not null check (char_length(trim(display_name_snapshot)) between 2 and 60),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  final_stage public.match_phase not null,
  final_rank integer check (final_rank is null or final_rank >= 1),
  matches_played integer not null default 0 check (matches_played >= 0),
  matches_won integer not null default 0 check (matches_won >= 0),
  total_points_scored integer not null default 0 check (total_points_scored >= 0),
  ranking_points integer not null default 0 check (ranking_points >= 0),
  capots_passed integer not null default 0 check (capots_passed >= 0),
  generales_passed integer not null default 0 check (generales_passed >= 0),
  coinches_passed integer not null default 0 check (coinches_passed >= 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, profile_id)
);

-- Table 12 : Limitation de debit distribuee (compatible Vercel Serverless)
create table public.rate_limit_buckets (
  bucket_key text primary key check (char_length(bucket_key) between 3 and 200),
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Table 13 : Journal d'audit securite (actions Admin, forfaits, echecs auth)
create table public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_team_id uuid references public.teams(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  target_table text not null check (char_length(target_table) between 2 and 80),
  target_id uuid,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Index de performance pour les lectures temps reel et anti-IDOR
-- ----------------------------------------------------------------------------
create index idx_teams_tournament on public.teams(tournament_id);
create index idx_teams_profiles on public.teams(player_1_profile_id, player_2_profile_id);
create index idx_pools_tournament on public.pools(tournament_id);
create index idx_pool_memberships_pool on public.pool_memberships(pool_id);
create index idx_matches_tournament_phase on public.matches(tournament_id, phase, status);
create index idx_matches_teams on public.matches(team_a_id, team_b_id);
create index idx_match_deals_match on public.match_deals(match_id, deal_number);
create index idx_live_announcements_tournament on public.live_announcements(tournament_id, created_at desc);
create index idx_referee_alerts_tournament_status on public.referee_alerts(tournament_id, status);
create index idx_annual_leaderboard_year on public.annual_leaderboard_entries(school_year, ranking_points desc);

-- ----------------------------------------------------------------------------
-- 4. Fonctions utilitaires securisees & Triggers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create trigger trg_team_secrets_updated_at
  before update on public.team_secrets
  for each row execute function public.set_updated_at();

create trigger trg_matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

create trigger trg_match_deals_updated_at
  before update on public.match_deals
  for each row execute function public.set_updated_at();

-- Verification serveur du role Admin sans recursion RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- Verification qu'un compte joueur optionnel appartient bien a l'equipe visee (Anti-IDOR)
create or replace function public.user_belongs_to_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and auth.uid() is not null
      and (t.player_1_profile_id = auth.uid() or t.player_2_profile_id = auth.uid())
  );
$$;

-- Verification qu'un joueur authentifie participe a un match modifiable (Anti-IDOR + verrouillage)
create or replace function public.user_can_write_match(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    inner join public.tournaments tr on tr.id = m.tournament_id
    where m.id = target_match_id
      and m.locked_by_admin = false
      and tr.player_score_editing_enabled = true
      and m.status in ('pending', 'in_progress')
      and (
        public.user_belongs_to_team(m.team_a_id)
        or public.user_belongs_to_team(m.team_b_id)
      )
  );
$$;

-- Creation automatique d'un profil 'player' a l'inscription Supabase Auth
-- Jamais de promotion 'admin' via raw_user_meta_data client
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  extracted_name text;
begin
  extracted_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'Joueur'), '@', 1)
  );

  if char_length(extracted_name) < 2 then
    extracted_name := 'Joueur';
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, left(extracted_name, 60), 'player')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Protection stricte contre toute auto-promotion au role 'admin'
create or replace function public.guard_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Modification du role interdite';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Modification directe de l''adresse email interdite';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_guard_profile_sensitive_columns
  before update on public.profiles
  for each row execute function public.guard_profile_sensitive_columns();

-- Consommation atomique d'un jeton de rate-limiting (appelee uniquement par service_role)
create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_max_attempts integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limit_buckets%rowtype;
  v_next_attempts integer;
  v_blocked_until timestamptz;
begin
  select *
  into v_row
  from public.rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if not found then
    insert into public.rate_limit_buckets (bucket_key, attempts, window_started_at, blocked_until, updated_at)
    values (p_bucket_key, 1, v_now, null, v_now);

    return query select true, greatest(p_max_attempts - 1, 0), 0;
    return;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return query select
      false,
      0,
      ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer;
    return;
  end if;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.rate_limit_buckets
    set attempts = 1,
        window_started_at = v_now,
        blocked_until = null,
        updated_at = v_now
    where bucket_key = p_bucket_key;

    return query select true, greatest(p_max_attempts - 1, 0), 0;
    return;
  end if;

  v_next_attempts := v_row.attempts + 1;

  if v_next_attempts > p_max_attempts then
    v_blocked_until := v_now + make_interval(secs => p_block_seconds);
    update public.rate_limit_buckets
    set attempts = v_next_attempts,
        blocked_until = v_blocked_until,
        updated_at = v_now
    where bucket_key = p_bucket_key;

    return query select false, 0, p_block_seconds;
    return;
  end if;

  update public.rate_limit_buckets
  set attempts = v_next_attempts,
      updated_at = v_now
  where bucket_key = p_bucket_key;

  return query select true, greatest(p_max_attempts - v_next_attempts, 0), 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer, integer) to service_role;

-- ----------------------------------------------------------------------------
-- 5. Activation stricte de RLS sur CHAQUE table (13 / 13)
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.tournaments enable row level security;
alter table public.tournaments force row level security;

alter table public.pools enable row level security;
alter table public.pools force row level security;

alter table public.teams enable row level security;
alter table public.teams force row level security;

alter table public.team_secrets enable row level security;
alter table public.team_secrets force row level security;

alter table public.pool_memberships enable row level security;
alter table public.pool_memberships force row level security;

alter table public.matches enable row level security;
alter table public.matches force row level security;

alter table public.match_deals enable row level security;
alter table public.match_deals force row level security;

alter table public.live_announcements enable row level security;
alter table public.live_announcements force row level security;

alter table public.referee_alerts enable row level security;
alter table public.referee_alerts force row level security;

alter table public.annual_leaderboard_entries enable row level security;
alter table public.annual_leaderboard_entries force row level security;

alter table public.rate_limit_buckets enable row level security;
alter table public.rate_limit_buckets force row level security;

alter table public.security_audit_logs enable row level security;
alter table public.security_audit_logs force row level security;

-- ----------------------------------------------------------------------------
-- 6. Politiques RLS table par table
-- ----------------------------------------------------------------------------

-- [1] profiles : lecture/edition de son propre profil uniquement, ou Admin
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_self_or_admin"
  on public.profiles for insert
  with check ((auth.uid() = id and role = 'player') or public.is_admin());

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "profiles_delete_admin_only"
  on public.profiles for delete
  using (public.is_admin());

-- [2] tournaments : lecture publique hors brouillon, ecriture Admin uniquement
create policy "tournaments_select_published_or_admin"
  on public.tournaments for select
  using (status <> 'draft' or public.is_admin());

create policy "tournaments_admin_write"
  on public.tournaments for all
  using (public.is_admin())
  with check (public.is_admin());

-- [3] pools : lecture publique des tournois publies, ecriture Admin uniquement
create policy "pools_select_published_or_admin"
  on public.pools for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments tr
      where tr.id = pools.tournament_id and tr.status <> 'draft'
    )
  );

create policy "pools_admin_write"
  on public.pools for all
  using (public.is_admin())
  with check (public.is_admin());

-- [4] teams : lecture publique des tournois publies (sans code secret), ecriture Admin uniquement
create policy "teams_select_published_or_admin"
  on public.teams for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments tr
      where tr.id = teams.tournament_id and tr.status <> 'draft'
    )
  );

create policy "teams_admin_write"
  on public.teams for all
  using (public.is_admin())
  with check (public.is_admin());

-- [5] team_secrets : strictement reservee a l'Admin (et service_role cote serveur)
create policy "team_secrets_admin_only"
  on public.team_secrets for all
  using (public.is_admin())
  with check (public.is_admin());

-- [6] pool_memberships : lecture publique des tournois publies, ecriture Admin uniquement
create policy "pool_memberships_select_published_or_admin"
  on public.pool_memberships for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments tr
      where tr.id = pool_memberships.tournament_id and tr.status <> 'draft'
    )
  );

create policy "pool_memberships_admin_write"
  on public.pool_memberships for all
  using (public.is_admin())
  with check (public.is_admin());

-- [7] matches : lecture publique temps reel ; mise a jour autorisee a l'Admin ou joueur authentifie du match non verrouille
create policy "matches_select_published_or_admin"
  on public.matches for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments tr
      where tr.id = matches.tournament_id and tr.status <> 'draft'
    )
  );

create policy "matches_admin_insert_delete"
  on public.matches for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "matches_player_update_own_unlocked_match"
  on public.matches for update
  using (public.user_can_write_match(id))
  with check (
    locked_by_admin = false
    and (
      public.user_belongs_to_team(team_a_id)
      or public.user_belongs_to_team(team_b_id)
    )
  );

-- [8] match_deals : lecture publique temps reel ; saisie limitee aux joueurs du match non verrouille ou Admin
create policy "match_deals_select_published_or_admin"
  on public.match_deals for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments tr
      where tr.id = match_deals.tournament_id and tr.status <> 'draft'
    )
  );

create policy "match_deals_admin_all"
  on public.match_deals for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "match_deals_player_insert_own_match"
  on public.match_deals for insert
  with check (
    public.user_can_write_match(match_id)
    and (recorded_by_team_id is null or public.user_belongs_to_team(recorded_by_team_id))
  );

create policy "match_deals_player_update_own_match"
  on public.match_deals for update
  using (public.user_can_write_match(match_id))
  with check (public.user_can_write_match(match_id));

-- [9] live_announcements : lecture publique pour /live ; emission par les joueurs du match ou Admin
create policy "live_announcements_select_published_or_admin"
  on public.live_announcements for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments tr
      where tr.id = live_announcements.tournament_id and tr.status <> 'draft'
    )
  );

create policy "live_announcements_admin_all"
  on public.live_announcements for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "live_announcements_player_insert_own_match"
  on public.live_announcements for insert
  with check (
    public.user_can_write_match(match_id)
    and (team_id is null or public.user_belongs_to_team(team_id))
  );

create policy "live_announcements_player_resolve_own_match"
  on public.live_announcements for update
  using (public.user_can_write_match(match_id))
  with check (public.user_can_write_match(match_id));

-- [10] referee_alerts : lecture/traitement par l'Admin, lecture/creation de ses propres alertes par l'equipe du match
create policy "referee_alerts_select_admin_or_requesting_team"
  on public.referee_alerts for select
  using (
    public.is_admin()
    or (requesting_team_id is not null and public.user_belongs_to_team(requesting_team_id))
  );

create policy "referee_alerts_insert_own_match"
  on public.referee_alerts for insert
  with check (
    public.is_admin()
    or (
      requesting_team_id is not null
      and public.user_belongs_to_team(requesting_team_id)
      and exists (
        select 1 from public.matches m
        where m.id = referee_alerts.match_id
          and (m.team_a_id = requesting_team_id or m.team_b_id = requesting_team_id)
      )
    )
  );

create policy "referee_alerts_admin_update_delete"
  on public.referee_alerts for all
  using (public.is_admin())
  with check (public.is_admin());

-- [11] annual_leaderboard_entries : lecture publique du classement annuel, ecriture Admin uniquement
create policy "annual_leaderboard_public_read"
  on public.annual_leaderboard_entries for select
  using (true);

create policy "annual_leaderboard_admin_write"
  on public.annual_leaderboard_entries for all
  using (public.is_admin())
  with check (public.is_admin());

-- [12] rate_limit_buckets : aucun acces client (Admin lecture diagnostic uniquement, mutations via RPC service_role)
create policy "rate_limit_buckets_admin_read_only"
  on public.rate_limit_buckets for select
  using (public.is_admin());

-- [13] security_audit_logs : lecture et ecriture Admin uniquement (et service_role cote serveur)
create policy "security_audit_logs_admin_only"
  on public.security_audit_logs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. Bucket Storage 'posters' (Affiches dynamiques de soiree) & Politiques RLS
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posters',
  'posters',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "posters_public_read"
  on storage.objects for select
  using (bucket_id = 'posters');

create policy "posters_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'posters' and public.is_admin());

create policy "posters_admin_update"
  on storage.objects for update
  using (bucket_id = 'posters' and public.is_admin())
  with check (bucket_id = 'posters' and public.is_admin());

create policy "posters_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'posters' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. Publication Supabase Realtime
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.pools;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.pool_memberships;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_deals;
alter publication supabase_realtime add table public.live_announcements;
alter publication supabase_realtime add table public.referee_alerts;
