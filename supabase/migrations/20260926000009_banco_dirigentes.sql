-- ============================================================================
-- 09 - Banco de dirigentes
--
-- Fichas longitudinales de dirigentes: conocimiento, imagen positiva/negativa
-- y segmento, medidos una o varias veces en el tiempo. Cada medición puede
-- atarse al proyecto (estudio) que la generó, pero es opcional.
-- ============================================================================

create table if not exists public.dirigentes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  role            text,
  affiliation     text,
  photo_url       text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists dirigentes_org_idx on public.dirigentes(organization_id);

create table if not exists public.dirigente_mediciones (
  id                uuid primary key default gen_random_uuid(),
  dirigente_id      uuid not null references public.dirigentes(id) on delete cascade,
  project_id        uuid references public.projects(id) on delete set null,
  conocimiento      numeric(5,2) check (conocimiento is null or conocimiento between 0 and 100),
  imagen_positiva   numeric(5,2) check (imagen_positiva is null or imagen_positiva between 0 and 100),
  imagen_negativa   numeric(5,2) check (imagen_negativa is null or imagen_negativa between 0 and 100),
  segmento          text,
  notes             text,
  measured_at       timestamptz not null default now(),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists dirigente_mediciones_dirigente_idx
  on public.dirigente_mediciones(dirigente_id, measured_at desc);

alter table public.dirigentes           enable row level security;
alter table public.dirigente_mediciones enable row level security;

create policy "dirigentes_select" on public.dirigentes
  for select to authenticated using (public.is_org_member(organization_id));
create policy "dirigentes_write" on public.dirigentes
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));

create policy "dirigente_mediciones_select" on public.dirigente_mediciones
  for select to authenticated
  using (exists (
    select 1 from public.dirigentes d
    where d.id = dirigente_id and public.is_org_member(d.organization_id)
  ));
create policy "dirigente_mediciones_write" on public.dirigente_mediciones
  for all to authenticated
  using (exists (
    select 1 from public.dirigentes d
    where d.id = dirigente_id and public.is_org_manager(d.organization_id)
  ))
  with check (exists (
    select 1 from public.dirigentes d
    where d.id = dirigente_id and public.is_org_manager(d.organization_id)
  ));
