-- ============================================================================
-- 02 - Row Level Security
--
-- Modelo de acceso:
--   super_admin  -> administracion central, ve y edita todo
--   org_admin    -> administra su organizacion (cliente)
--   org_analyst  -> lectura del panel de su organizacion
--   surveyor     -> solo las encuestas asignadas y sus propias respuestas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers. Son SECURITY DEFINER a proposito: evitan la recursion infinita que
-- se produciria si una policy de `profiles` consultara `profiles` con RLS.
-- ----------------------------------------------------------------------------
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public as $fn$
  select role from public.profiles where id = auth.uid();
$fn$;

create or replace function public.app_org()
returns uuid
language sql stable security definer set search_path = public as $fn$
  select organization_id from public.profiles where id = auth.uid();
$fn$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(public.app_role() = 'super_admin', false);
$fn$;

-- Puede administrar (escribir) contenido de la organizacion
create or replace function public.is_org_manager(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_super_admin()
      or (public.app_role() = 'org_admin' and public.app_org() = target_org);
$fn$;

-- Pertenece a la organizacion (cualquier rol interno)
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_super_admin() or public.app_org() = target_org;
$fn$;

create or replace function public.can_read_survey(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
    from public.surveys s
    where s.id = sid
      and (
        public.is_super_admin()
        or s.organization_id = public.app_org()
        or exists (
          select 1 from public.survey_assignments a
          where a.survey_id = s.id and a.surveyor_id = auth.uid()
        )
      )
  );
$fn$;

create or replace function public.can_manage_survey(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.surveys s
    where s.id = sid and public.is_org_manager(s.organization_id)
  );
$fn$;

create or replace function public.owns_response(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.responses r
    where r.id = rid
      and (r.surveyor_id = auth.uid() or public.is_org_member(r.organization_id))
  );
$fn$;

create or replace function public.can_edit_response(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.responses r
    where r.id = rid
      and (
        (r.surveyor_id = auth.uid() and r.status = 'en_curso')
        or public.is_org_manager(r.organization_id)
      )
  );
$fn$;

-- ----------------------------------------------------------------------------
alter table public.organizations      enable row level security;
alter table public.profiles           enable row level security;
alter table public.projects           enable row level security;
alter table public.surveys            enable row level security;
alter table public.questions          enable row level security;
alter table public.question_options   enable row level security;
alter table public.survey_assignments enable row level security;
alter table public.responses          enable row level security;
alter table public.answers            enable row level security;
alter table public.ai_reports         enable row level security;

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create policy "org_select" on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy "org_insert" on public.organizations
  for insert to authenticated
  with check (public.is_super_admin());

create policy "org_update" on public.organizations
  for update to authenticated
  using (public.is_org_manager(id))
  with check (public.is_org_manager(id));

create policy "org_delete" on public.organizations
  for delete to authenticated
  using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (organization_id is not null and organization_id = public.app_org())
  );

create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_org_manager(organization_id));

-- El propio usuario puede editarse; los managers pueden editar a su gente.
-- El cambio de rol se restringe por trigger (mas abajo).
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_org_manager(organization_id))
  with check (id = auth.uid() or public.is_org_manager(organization_id));

create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- Nadie se auto-asciende: solo un manager puede cambiar rol u organizacion.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- Sin usuario autenticado estamos ante la service role, una migracion o el
  -- SQL editor. Esos contextos ya pasaron un control mas fuerte que este.
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id then
    if not (public.app_role() = 'org_admin'
            and public.app_org() = old.organization_id
            and new.organization_id = old.organization_id
            and new.role <> 'super_admin') then
      raise exception 'No tiene permisos para modificar rol u organizacion';
    end if;
  end if;

  return new;
end;
$fn$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create policy "projects_select" on public.projects
  for select to authenticated using (public.is_org_member(organization_id));
create policy "projects_write" on public.projects
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));

-- ----------------------------------------------------------------------------
-- surveys
-- ----------------------------------------------------------------------------
create policy "surveys_select" on public.surveys
  for select to authenticated using (public.can_read_survey(id));
create policy "surveys_insert" on public.surveys
  for insert to authenticated with check (public.is_org_manager(organization_id));
create policy "surveys_update" on public.surveys
  for update to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));
create policy "surveys_delete" on public.surveys
  for delete to authenticated using (public.is_org_manager(organization_id));

-- ----------------------------------------------------------------------------
-- questions / question_options
-- ----------------------------------------------------------------------------
create policy "questions_select" on public.questions
  for select to authenticated using (public.can_read_survey(survey_id));
create policy "questions_write" on public.questions
  for all to authenticated
  using (public.can_manage_survey(survey_id))
  with check (public.can_manage_survey(survey_id));

create policy "options_select" on public.question_options
  for select to authenticated
  using (exists (select 1 from public.questions q
                 where q.id = question_id and public.can_read_survey(q.survey_id)));
create policy "options_write" on public.question_options
  for all to authenticated
  using (exists (select 1 from public.questions q
                 where q.id = question_id and public.can_manage_survey(q.survey_id)))
  with check (exists (select 1 from public.questions q
                 where q.id = question_id and public.can_manage_survey(q.survey_id)));

-- ----------------------------------------------------------------------------
-- survey_assignments
-- ----------------------------------------------------------------------------
create policy "assignments_select" on public.survey_assignments
  for select to authenticated
  using (surveyor_id = auth.uid() or public.can_manage_survey(survey_id));
create policy "assignments_write" on public.survey_assignments
  for all to authenticated
  using (public.can_manage_survey(survey_id))
  with check (public.can_manage_survey(survey_id));

-- ----------------------------------------------------------------------------
-- responses
-- ----------------------------------------------------------------------------
create policy "responses_select" on public.responses
  for select to authenticated
  using (surveyor_id = auth.uid() or public.is_org_member(organization_id));

create policy "responses_insert" on public.responses
  for insert to authenticated
  with check (
    public.is_org_manager(organization_id)
    or (
      surveyor_id = auth.uid()
      and exists (
        select 1 from public.survey_assignments a
        join public.surveys s on s.id = a.survey_id
        where a.survey_id = responses.survey_id
          and a.surveyor_id = auth.uid()
          and s.status = 'activa'
          and s.organization_id = responses.organization_id
      )
    )
  );

create policy "responses_update" on public.responses
  for update to authenticated
  using (
    public.is_org_manager(organization_id)
    or (surveyor_id = auth.uid() and status = 'en_curso')
  )
  with check (public.is_org_manager(organization_id) or surveyor_id = auth.uid());

create policy "responses_delete" on public.responses
  for delete to authenticated using (public.is_org_manager(organization_id));

-- ----------------------------------------------------------------------------
-- answers
-- ----------------------------------------------------------------------------
create policy "answers_select" on public.answers
  for select to authenticated using (public.owns_response(response_id));
create policy "answers_insert" on public.answers
  for insert to authenticated with check (public.can_edit_response(response_id));
create policy "answers_update" on public.answers
  for update to authenticated
  using (public.can_edit_response(response_id))
  with check (public.can_edit_response(response_id));
create policy "answers_delete" on public.answers
  for delete to authenticated using (public.can_edit_response(response_id));

-- ----------------------------------------------------------------------------
-- ai_reports
-- ----------------------------------------------------------------------------
create policy "reports_select" on public.ai_reports
  for select to authenticated using (public.is_org_member(organization_id));
create policy "reports_write" on public.ai_reports
  for all to authenticated
  using (public.is_org_manager(organization_id))
  with check (public.is_org_manager(organization_id));
