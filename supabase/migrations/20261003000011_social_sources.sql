-- Fuentes de escucha e historial de cada importación. Cada tema, feed y
-- corrida queda en la base: el radar no vive solo en la pantalla.

create table if not exists public.social_sources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind            text not null check (kind in ('rss', 'noticias')),
  name            text not null,
  query           text,
  url             text,
  is_active       boolean not null default true,
  last_fetched_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists social_sources_org_idx on public.social_sources(organization_id);

create table if not exists public.social_imports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id       uuid references public.social_sources(id) on delete set null,
  mode            text not null,
  inserted        integer not null default 0,
  duplicates      integer not null default 0,
  status          text not null default 'ok' check (status in ('ok', 'error')),
  error_message   text,
  created_at      timestamptz not null default now()
);
create index if not exists social_imports_org_idx on public.social_imports(organization_id, created_at desc);

alter table public.social_sources enable row level security;
alter table public.social_imports enable row level security;

create policy "social_sources_select" on public.social_sources
  for select to authenticated using (public.is_org_member(organization_id));
create policy "social_sources_write" on public.social_sources
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));

create policy "social_imports_select" on public.social_imports
  for select to authenticated using (public.is_org_member(organization_id));
create policy "social_imports_write" on public.social_imports
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));
