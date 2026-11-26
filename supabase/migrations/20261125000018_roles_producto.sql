-- ============================================================================
-- 18 - Roles de producto
--
-- Modelo:
--   super_admin  -> Administración central (Compol)
--   org_admin    -> Administrador del organismo (panel cliente, escribe)
--   politico     -> Político (solo lectura de resultados / radar / biblioteca)
--   surveyor     -> Encuestador (campo)
--   org_analyst  -> legacy; se trata como lectura (= político) en la app
--
-- La base ya tenía el enum `politico` y policies parciales; esta migración
-- cierra el círculo: el Administrador vuelve a poder escribir, y el Político
-- puede leer proyectos y respuestas/answers de su organismo.
-- ============================================================================

-- Asegurar enum (idempotente si ya existe)
do $enum$
begin
  alter type public.user_role add value if not exists 'politico';
exception
  when duplicate_object then null;
end
$enum$;

-- Administrador del organismo escribe; super_admin escribe en todos.
create or replace function public.is_org_manager(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_super_admin()
      or (
        public.app_role() = 'org_admin'
        and public.app_org() = target_org
      );
$function$;

-- Lectura de cualquier miembro activo de la org, incluido político.
create or replace function public.can_read_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_super_admin()
      or (
        public.is_user_active()
        and public.app_org() = target_org
      );
$function$;

-- Miembro "operativo" (no político): ve equipo y opera lo no-resultados.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_super_admin()
      or (
        public.app_org() = target_org
        and public.app_role() is distinct from 'politico'
      );
$function$;

-- Answers: el político necesita leer para el tablero / resultados.
create or replace function public.owns_response(rid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.responses r
    where r.id = rid
      and (
        r.surveyor_id = auth.uid()
        or public.can_read_org(r.organization_id)
      )
  );
$function$;

-- Projects: el político puede listar para contexto, aunque la UI no lo enfatice.
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select to authenticated
  using (public.can_read_org(organization_id));

-- Refuerzo de lectura org / respuestas / posts / informes (idempotente).
drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select to authenticated
  using (public.can_read_org(id));

drop policy if exists "responses_select" on public.responses;
create policy "responses_select" on public.responses
  for select to authenticated
  using (
    (public.is_user_active() and surveyor_id = auth.uid())
    or public.can_read_org(organization_id)
  );

drop policy if exists "social_posts_select" on public.social_posts;
create policy "social_posts_select" on public.social_posts
  for select to authenticated
  using (public.can_read_org(organization_id));

drop policy if exists "reports_select" on public.ai_reports;
create policy "reports_select" on public.ai_reports
  for select to authenticated
  using (public.can_read_org(organization_id));
