-- Migration 0003 : Comptes joueurs club (pseudo + mot de passe scrypt) et verrous anti-troll par table
-- RLS activee sans aucun acces public direct : toutes les verifications passent par les routes API serveur.

create table if not exists public.club_accounts (
  id text primary key,
  pseudo text not null,
  normalized_pseudo text not null unique,
  first_name text not null,
  password_hash text not null,
  school_year text not null default '2026-2027',
  created_at timestamptz not null default now()
);

create table if not exists public.table_scorer_locks (
  match_id text primary key,
  table_code text not null,
  holder_id text not null,
  holder_label text not null,
  lock_version integer not null default 1,
  claimed_at timestamptz not null default now()
);

alter table public.club_accounts enable row level security;
alter table public.table_scorer_locks enable row level security;

-- Zero policy publique SELECT/INSERT/UPDATE/DELETE :
-- Les mots de passe haches et verrous de tables ne sont accessibles que par le serveur (service_role).
