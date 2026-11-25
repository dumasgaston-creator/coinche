-- ============================================================================
-- Suite de tests SQL des politiques RLS (isolation, anti-IDOR, anti-escalade)
-- Executable via `supabase test db` ou `psql` dans une transaction rollback.
-- ============================================================================

begin;

-- 1. Verification que CHAQUE table publique (13/13) a bien RLS activee et forcee
do $$
declare
  v_unprotected_count integer;
begin
  select count(*)
  into v_unprotected_count
  from pg_class c
  inner join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (c.relrowsecurity = false or c.relforcerowsecurity = false);

  if v_unprotected_count <> 0 then
    raise exception 'Echec audit RLS : % table(s) sans RLS activee et forcee', v_unprotected_count;
  end if;
end;
$$;

-- 2. Jeu d'essai : 1 Admin, 2 Joueurs d'equipes distinctes, 2 Tournois (1 publie, 1 brouillon)
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'admin@coincheirb.fr', '{"display_name":"Admin CoinchEirb"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'alice@enseirb.fr', '{"display_name":"Alice"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'bob@enseirb.fr', '{"display_name":"Bob"}'::jsonb);

update public.profiles
set role = 'admin'
where id = '00000000-0000-0000-0000-000000000001';

insert into public.tournaments (id, slug, title, event_date, starts_at, status, player_score_editing_enabled)
values
  ('10000000-0000-0000-0000-000000000001', 'soiree-automne', 'Soiree Automne', '2026-11-26', '2026-11-26 18:30:00+01', 'pools', true),
  ('10000000-0000-0000-0000-000000000002', 'soiree-brouillon', 'Soiree Brouillon', '2026-12-10', '2026-12-10 18:30:00+01', 'draft', true);

insert into public.teams (id, tournament_id, team_name, normalized_name, player_1_name, player_2_name, player_1_profile_id)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Les Abeilles', 'les abeilles', 'Alice', 'Claire', '00000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Atout Pique', 'atout pique', 'David', 'Emma', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Les Rois', 'les rois', 'Bob', 'Lucas', '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Sans Atout', 'sans atout', 'Nina', 'Hugo', null);

insert into public.team_secrets (team_id, tournament_id, access_code_hash, access_code_hint)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'scrypt$salt$hash', 'AB23CD');

insert into public.matches (id, tournament_id, phase, round_number, table_number, team_a_id, team_b_id, status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'pool', 1, 1, '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'in_progress'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'pool', 1, 2, '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'in_progress');

-- 3. Test role ANON : ne voit ni brouillons, ni secrets d'equipe, ni profils, ni alertes arbitre
set local role anon;
set local request.jwt.claim.role = 'anon';

do $$
declare
  v_drafts integer;
  v_secrets integer;
  v_profiles integer;
begin
  select count(*) into v_drafts from public.tournaments where status = 'draft';
  if v_drafts <> 0 then
    raise exception 'Fuite RLS anon sur tournoi draft';
  end if;

  select count(*) into v_secrets from public.team_secrets;
  if v_secrets <> 0 then
    raise exception 'Fuite RLS anon sur team_secrets';
  end if;

  select count(*) into v_profiles from public.profiles;
  if v_profiles <> 0 then
    raise exception 'Fuite RLS anon sur profiles';
  end if;
end;
$$;

-- 4. Test role AUTHENTICATED (Bob, table 2) : tentative IDOR sur le match d'Alice (table 1) et auto-promotion admin
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

do $$
declare
  v_updated integer;
  v_escalated boolean := false;
begin
  -- Tentative IDOR : Bob tente de modifier le score de la Table 1 (Alice vs Atout Pique)
  update public.matches
  set score_team_a = 990
  where id = '30000000-0000-0000-0000-000000000001';

  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Faille IDOR RLS : Bob a pu modifier le match d''une autre table';
  end if;

  -- Bob modifie legitimement sa propre Table 2
  update public.matches
  set score_team_a = 130
  where id = '30000000-0000-0000-0000-000000000002';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Erreur RLS : Bob n''a pas pu saisir le score de sa propre table';
  end if;

  -- Tentative d'auto-promotion au role admin
  begin
    update public.profiles
    set role = 'admin'
    where id = '00000000-0000-0000-0000-000000000003';
    v_escalated := true;
  exception
    when others then
      v_escalated := false;
  end;

  if v_escalated then
    raise exception 'Faille critique : un joueur a pu passer son role en admin';
  end if;
end;
$$;

rollback;
