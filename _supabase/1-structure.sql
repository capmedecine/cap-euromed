-- =====================================================================
-- Espace étudiant Cap EuroMed : structure de la base (Supabase)
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.
-- Le contenu de la banque de questions n'est PAS dans ce dépôt (public) :
-- il est importé à part (script 2-questions-<matière>.sql).
-- =====================================================================

-- ---------- Profils (un par compte, créé automatiquement) ----------
create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nom text,
  role text not null default 'etudiant' check (role in ('etudiant', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profils enable row level security;

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profils where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profils : le sien, ou tous pour un admin" on public.profils;
create policy "profils : le sien, ou tous pour un admin" on public.profils
  for select to authenticated
  using (id = (select auth.uid()) or (select public.est_admin()));

create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, email, nom)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists creer_profil_apres_inscription on auth.users;
create trigger creer_profil_apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Comptes créés avant ce script
insert into public.profils (id, email, nom)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------- Banque de questions ----------
create table if not exists public.questions (
  id bigint generated always as identity primary key,
  matiere text not null check (matiere in ('chimie', 'biologie')),
  numero integer not null,
  enonce text not null,
  a text not null, b text not null, c text not null, d text not null,
  e text not null, f text not null, g text not null, h text not null,
  reponses text not null,  -- lettres des propositions justes, ex. « a,c,f »
  statut text not null default 'complete' check (statut in ('complete', 'a_reprendre')),
  unique (matiere, numero)
);
alter table public.questions enable row level security;

drop policy if exists "questions : lecture par les comptes connectés" on public.questions;
create policy "questions : lecture par les comptes connectés" on public.questions
  for select to authenticated
  using (statut = 'complete');

-- ---------- Progression (une ligne par étudiant et par question) ----------
create table if not exists public.progression (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id bigint not null references public.questions (id) on delete cascade,
  tentatives integer not null default 0,
  reussites integer not null default 0,
  dernier_juste boolean not null default false,
  a_revoir boolean not null default false,
  premiere_fois timestamptz not null default now(),
  mis_a_jour timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.progression enable row level security;

drop policy if exists "progression : la sienne" on public.progression;
create policy "progression : la sienne" on public.progression
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "progression : lecture par un admin" on public.progression;
create policy "progression : lecture par un admin" on public.progression
  for select to authenticated
  using ((select public.est_admin()));

-- Enregistre une réponse en entraînement (juste = les 8 propositions bien jugées)
create or replace function public.enregistrer_reponse(q bigint, juste boolean) returns void
language sql security invoker set search_path = public as $$
  insert into public.progression as p (user_id, question_id, tentatives, reussites, dernier_juste, a_revoir)
  values (auth.uid(), q, 1, case when juste then 1 else 0 end, juste, not juste)
  on conflict (user_id, question_id) do update set
    tentatives = p.tentatives + 1,
    reussites = p.reussites + case when juste then 1 else 0 end,
    dernier_juste = juste,
    a_revoir = not juste,
    mis_a_jour = now();
$$;

-- Marque « à revoir » les questions ratées en examen blanc
create or replace function public.marquer_a_revoir(ids bigint[]) returns void
language sql security invoker set search_path = public as $$
  insert into public.progression as p (user_id, question_id, a_revoir)
  select auth.uid(), x, true from unnest(ids) as x
  on conflict (user_id, question_id) do update set a_revoir = true, mis_a_jour = now();
$$;

-- ---------- Examens blancs ----------
create table if not exists public.examens (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  matiere text not null,
  score integer not null,
  score_max integer not null,
  duree_s integer not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists examens_user_date on public.examens (user_id, created_at desc);
alter table public.examens enable row level security;

drop policy if exists "examens : les siens, ou tous pour un admin" on public.examens;
create policy "examens : les siens, ou tous pour un admin" on public.examens
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists "examens : ajout des siens" on public.examens;
create policy "examens : ajout des siens" on public.examens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------- Suivi des étudiants (réservé aux admins) ----------
create or replace function public.suivi_etudiants()
returns table (
  id uuid, email text, nom text,
  vues integer, maitrisees integer, a_revoir integer,
  examens integer, dernier_examen numeric, meilleur_examen numeric,
  derniere_activite timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.nom,
    (select count(*) from progression g where g.user_id = p.id and g.tentatives > 0)::integer,
    (select count(*) from progression g where g.user_id = p.id and g.dernier_juste)::integer,
    (select count(*) from progression g where g.user_id = p.id and g.a_revoir)::integer,
    (select count(*) from examens x where x.user_id = p.id)::integer,
    (select round(100.0 * x.score / x.score_max, 1) from examens x where x.user_id = p.id order by x.created_at desc limit 1),
    (select max(round(100.0 * x.score / x.score_max, 1)) from examens x where x.user_id = p.id),
    greatest(
      (select max(g.mis_a_jour) from progression g where g.user_id = p.id),
      (select max(x.created_at) from examens x where x.user_id = p.id))
  from profils p
  where public.est_admin() and p.role = 'etudiant'
  order by p.nom;
$$;

-- ---------- Droits d'exécution ----------
revoke execute on function public.enregistrer_reponse(bigint, boolean) from public, anon;
revoke execute on function public.marquer_a_revoir(bigint[]) from public, anon;
revoke execute on function public.suivi_etudiants() from public, anon;
grant execute on function public.enregistrer_reponse(bigint, boolean) to authenticated;
grant execute on function public.marquer_a_revoir(bigint[]) to authenticated;
grant execute on function public.suivi_etudiants() to authenticated;
-- Fonctions internes : creer_profil ne sert qu'au déclencheur d'inscription ;
-- est_admin sert aux règles RLS des comptes connectés (jamais aux visiteurs sans compte).
revoke execute on function public.creer_profil() from public, anon, authenticated;
revoke execute on function public.est_admin() from public, anon;
grant execute on function public.est_admin() to authenticated;

-- ---------- Ton compte admin ----------
-- Après t'être invité (Authentication > Users > Invite user), remplace l'adresse
-- ci-dessous par la tienne, enlève les deux tirets du début de ligne et lance-la :
-- update public.profils set role = 'admin' where email = 'ton-adresse@exemple.com';
