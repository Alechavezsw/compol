-- ============================================================================
-- 18 - Rol politico
--
-- Lo da de alta la administracion central, dentro de una organizacion.
-- Solo lee los informes de esa organizacion y el nombre del organismo.
-- No ve encuestas, respuestas, redes, equipo ni el resto del panel.
-- Un admin de cliente no puede crear ni convertir cuentas a este rol.
-- ============================================================================

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_super_admin()
      or (
        public.app_org() = target_org
        and public.app_role() is distinct from 'politico'
      );
$fn$;

create or replace function public.can_read_survey(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_user_active() and exists (
    select 1
    from public.surveys s
    where s.id = sid
      and (
        public.is_super_admin()
        or (
          s.organization_id = public.app_org()
          and public.app_role() is distinct from 'politico'
        )
        or exists (
          select 1 from public.survey_assignments a
          where a.survey_id = s.id and a.surveyor_id = auth.uid()
        )
      )
  );
$fn$;

drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select to authenticated
  using (
    public.is_org_member(id)
    or (public.app_role() = 'politico' and public.app_org() = id)
  );

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (
      public.app_role() is distinct from 'politico'
      and organization_id is not null
      and organization_id = public.app_org()
    )
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (
      public.is_org_manager(organization_id)
      and role <> 'surveyor'
      and role <> 'politico'
    )
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or (
      public.is_org_manager(organization_id)
      and role <> 'surveyor'
      and role <> 'politico'
    )
  );

drop policy if exists "reports_select" on public.ai_reports;
create policy "reports_select" on public.ai_reports
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    or (public.app_role() = 'politico' and public.app_org() = organization_id)
  );

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id then
    if not coalesce(
      public.app_role() = 'org_admin'
      and public.app_org() = old.organization_id
      and new.organization_id = old.organization_id
      and new.role not in ('super_admin', 'surveyor', 'politico')
      and old.role <> 'surveyor'
      and old.role <> 'politico',
      false
    ) then
      raise exception 'No tiene permisos para modificar rol u organizacion';
    end if;
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Solo la administracion central puede activar o bloquear usuarios';
  end if;

  return new;
end;
$fn$;
