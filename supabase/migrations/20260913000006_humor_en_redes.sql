-- ============================================================================
-- 06 - Humor en redes
--
-- Escucha social por organización. Las publicaciones entran por importación
-- (CSV exportado de la herramienta de monitoreo o de Meta Business Suite),
-- por feeds RSS de portales o pegándolas a mano, y se clasifican con Gemini
-- (o con el léxico local si no hay clave): sentimiento, emoción y temas.
--
-- Privacidad: se guarda el texto público y un alias de autor. No se guardan
-- perfiles, seguidores ni datos que permitan reconstruir a una persona.
-- ============================================================================

create table if not exists public.social_trackers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  keywords        text[] not null default '{}',
  exclude         text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists social_trackers_org_idx on public.social_trackers(organization_id);

create table if not exists public.social_posts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  network         text not null default 'otros'
                  check (network in ('x','facebook','instagram','tiktok','youtube','noticias','otros')),
  external_id     text,
  author          text,
  url             text,
  text            text not null,
  published_at    timestamptz not null,
  engagement      integer not null default 0,
  sentiment       numeric(4,3) not null default 0 check (sentiment between -1 and 1),
  label           text not null default 'neutral' check (label in ('positivo','neutral','negativo')),
  emotion         text check (emotion in ('enojo','miedo','tristeza','alegria','confianza','sorpresa')),
  topics          text[] not null default '{}',
  classified_by   text not null default 'lexico',
  created_at      timestamptz not null default now(),
  unique (organization_id, network, external_id)
);
create index if not exists social_posts_org_date_idx on public.social_posts(organization_id, published_at desc);
create index if not exists social_posts_topics_idx on public.social_posts using gin (topics);

alter table public.social_trackers enable row level security;
alter table public.social_posts    enable row level security;

create policy "social_trackers_select" on public.social_trackers
  for select to authenticated using (public.is_org_member(organization_id));
create policy "social_trackers_write" on public.social_trackers
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));

create policy "social_posts_select" on public.social_posts
  for select to authenticated using (public.is_org_member(organization_id));
create policy "social_posts_write" on public.social_posts
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));
