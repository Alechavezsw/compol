-- ============================================================================
-- Plataforma de encuestas para gobiernos e instituciones
-- 01 - Esquema base
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'org_admin', 'org_analyst', 'surveyor');
create type public.org_type as enum ('gobierno', 'institucion', 'ong', 'privado');
create type public.org_status as enum ('activa', 'suspendida', 'prueba');
create type public.survey_status as enum ('borrador', 'activa', 'pausada', 'cerrada');
create type public.question_type as enum (
  'texto_corto', 'texto_largo', 'opcion_unica', 'opcion_multiple',
  'escala', 'numero', 'fecha', 'si_no'
);
create type public.response_status as enum ('en_curso', 'completada', 'descartada');
create type public.report_status as enum ('generando', 'listo', 'error');
create type public.report_kind as enum ('ejecutivo', 'tecnico', 'comunicacional', 'comparativo');

-- ----------------------------------------------------------------------------
-- Organizaciones (clientes: municipios, ministerios, universidades, camaras...)
-- ----------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  type          public.org_type not null default 'gobierno',
  status        public.org_status not null default 'prueba',
  contact_email text,
  contact_phone text,
  country       text default 'Argentina',
  region        text,
  logo_url      text,
  brand_color   text default '#1e40af',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Perfiles (extiende auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name       text not null default '',
  email           text,
  phone           text,
  role            public.user_role not null default 'surveyor',
  avatar_url      text,
  is_active       boolean not null default true,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_org_idx on public.profiles(organization_id);
create index profiles_role_idx on public.profiles(role);

-- ----------------------------------------------------------------------------
-- Proyectos / estudios (agrupan olas de encuestas)
-- ----------------------------------------------------------------------------
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  color           text default '#0ea5a4',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index projects_org_idx on public.projects(organization_id);

-- ----------------------------------------------------------------------------
-- Encuestas
-- ----------------------------------------------------------------------------
create table public.surveys (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete set null,
  title            text not null,
  description      text,
  status           public.survey_status not null default 'borrador',
  target_responses integer not null default 400,
  starts_at        timestamptz,
  ends_at          timestamptz,
  geography        text,
  methodology      text default 'Presencial cara a cara',
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index surveys_org_idx on public.surveys(organization_id);
create index surveys_status_idx on public.surveys(status);

-- ----------------------------------------------------------------------------
-- Preguntas
-- ----------------------------------------------------------------------------
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.surveys(id) on delete cascade,
  position    integer not null default 0,
  type        public.question_type not null default 'opcion_unica',
  text        text not null,
  help_text   text,
  is_required boolean not null default true,
  section     text,
  min_value   numeric,
  max_value   numeric,
  created_at  timestamptz not null default now()
);
create index questions_survey_idx on public.questions(survey_id, position);

create table public.question_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  position     integer not null default 0,
  label        text not null,
  value        text,
  is_exclusive boolean not null default false
);
create index question_options_q_idx on public.question_options(question_id, position);

-- ----------------------------------------------------------------------------
-- Asignaciones de encuestadores
-- ----------------------------------------------------------------------------
create table public.survey_assignments (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.surveys(id) on delete cascade,
  surveyor_id uuid not null references public.profiles(id) on delete cascade,
  quota       integer not null default 50,
  zone        text,
  created_at  timestamptz not null default now(),
  unique (survey_id, surveyor_id)
);
create index assignments_surveyor_idx on public.survey_assignments(surveyor_id);

-- ----------------------------------------------------------------------------
-- Respuestas (una por persona encuestada)
-- ----------------------------------------------------------------------------
create table public.responses (
  id               uuid primary key default gen_random_uuid(),
  survey_id        uuid not null references public.surveys(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  surveyor_id      uuid references public.profiles(id) on delete set null,
  status           public.response_status not null default 'en_curso',
  zone             text,
  latitude         double precision,
  longitude        double precision,
  duration_seconds integer,
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz
);
create index responses_survey_idx on public.responses(survey_id);
create index responses_surveyor_idx on public.responses(surveyor_id);
create index responses_status_idx on public.responses(survey_id, status);

create table public.answers (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid not null references public.responses(id) on delete cascade,
  question_id  uuid not null references public.questions(id) on delete cascade,
  value_text   text,
  value_number numeric,
  value_date   date,
  option_ids   uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  unique (response_id, question_id)
);
create index answers_question_idx on public.answers(question_id);

-- ----------------------------------------------------------------------------
-- Informes generados con IA (Gemini)
-- ----------------------------------------------------------------------------
create table public.ai_reports (
  id              uuid primary key default gen_random_uuid(),
  survey_id       uuid not null references public.surveys(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  kind            public.report_kind not null default 'ejecutivo',
  status          public.report_status not null default 'generando',
  model           text,
  audience        text,
  focus           text,
  content         text,
  highlights      jsonb not null default '[]'::jsonb,
  error_message   text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index ai_reports_survey_idx on public.ai_reports(survey_id);
create index ai_reports_org_idx on public.ai_reports(organization_id);

-- ----------------------------------------------------------------------------
-- Alta automatica de perfil al crear el usuario en auth
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'surveyor')
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- updated_at
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger surveys_touch before update on public.surveys
  for each row execute function public.touch_updated_at();
