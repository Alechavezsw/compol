-- ============================================================================
-- 05 - El equipo de campo lo gestiona solo la administración central
--
-- Antes, el admin de cada cliente podía asignar encuestadores y editar sus
-- perfiles. Ahora:
--   * survey_assignments: solo super_admin escribe. El cliente sigue leyendo
--     (para ver el avance) y el encuestador ve sus propias asignaciones.
--   * profiles de rol 'surveyor': solo super_admin los modifica (bloqueo,
--     organización, datos). Cada encuestador puede editar su propio perfil,
--     pero no su rol ni su organización (trigger existente).
-- ============================================================================

drop policy if exists "assignments_write" on public.survey_assignments;
create policy "assignments_write" on public.survey_assignments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (public.is_org_manager(organization_id) and role <> 'surveyor')
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or (public.is_org_manager(organization_id) and role <> 'surveyor')
  );

-- Un admin de cliente tampoco puede convertir a alguien en encuestador (ni al
-- revés): eso también es armar el equipo de campo.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id then
    if not (public.app_role() = 'org_admin'
            and public.app_org() = old.organization_id
            and new.organization_id = old.organization_id
            and new.role not in ('super_admin', 'surveyor')
            and old.role <> 'surveyor') then
      raise exception 'No tiene permisos para modificar rol u organizacion';
    end if;
  end if;

  if new.is_active is distinct from old.is_active and old.role = 'surveyor' then
    raise exception 'Solo la administracion central puede bloquear encuestadores';
  end if;

  return new;
end;
$fn$;
