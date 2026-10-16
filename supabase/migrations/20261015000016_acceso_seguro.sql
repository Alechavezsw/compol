-- ============================================================================
-- 16 - Acceso seguro: alta de usuarios y bloqueo efectivo
--
-- 1. handle_new_user ya no confia en el rol que viene en la metadata del
--    registro. Con el registro publico de Supabase abierto, cualquiera podia
--    llamar a signUp con data.role = 'super_admin' y obtener un administrador.
--    Todo perfil nace como 'surveyor' sin organizacion; el alta legitima
--    (createUserAction, con service role) completa rol y organizacion despues.
--
-- 2. `is_active` pasa a valer de verdad en la base:
--    * Un usuario bloqueado pierde todo acceso por RLS aunque conserve un
--      token vigente (antes solo lo cortaba la interfaz).
--    * Nadie cambia `is_active` salvo la administracion central. Antes un
--      org_admin u org_analyst bloqueado podia reactivarse editando su perfil.
--    * Sigue pudiendo leer su propio perfil, para que la app le muestre el
--      aviso de cuenta desactivada.
--
-- 3. profiles_insert se cierra a la administracion central. Ningun cliente de
--    la app inserta perfiles: los crea el trigger o la service role. La regla
--    anterior (`id = auth.uid()`) dejaba a quien no tuviera perfil crearse uno
--    con el rol que quisiera.
--
-- Esta migracion NO desactiva el registro publico: eso se hace en el panel de
-- Supabase (Authentication > Sign In / Providers > "Allow new users to sign
-- up"). La app solo usa auth.admin.createUser, que sigue funcionando.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Alta de perfil: el rol no se toma de la metadata
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
    'surveyor'
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- 2a. Helpers: un usuario bloqueado no tiene rol ni organizacion
-- ----------------------------------------------------------------------------
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public as $fn$
  select role from public.profiles where id = auth.uid() and is_active;
$fn$;

create or replace function public.app_org()
returns uuid
language sql stable security definer set search_path = public as $fn$
  select organization_id from public.profiles where id = auth.uid() and is_active;
$fn$;

-- Para las reglas que miran `auth.uid()` directo (encuestadores con
-- asignaciones o respuestas propias) y no pasan por app_role()/app_org().
create or replace function public.is_user_active()
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
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
        or s.organization_id = public.app_org()
        or exists (
          select 1 from public.survey_assignments a
          where a.survey_id = s.id and a.surveyor_id = auth.uid()
        )
      )
  );
$fn$;

create or replace function public.owns_response(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.responses r
    where r.id = rid
      and (
        (public.is_user_active() and r.surveyor_id = auth.uid())
        or public.is_org_member(r.organization_id)
      )
  );
$fn$;

create or replace function public.can_edit_response(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.responses r
    where r.id = rid
      and (
        (public.is_user_active() and r.surveyor_id = auth.uid() and r.status = 'en_curso')
        or public.is_org_manager(r.organization_id)
      )
  );
$fn$;

-- ----------------------------------------------------------------------------
-- 2b. Politicas que comparan `auth.uid()` sin pasar por los helpers
-- ----------------------------------------------------------------------------
drop policy if exists "assignments_select" on public.survey_assignments;
create policy "assignments_select" on public.survey_assignments
  for select to authenticated
  using (
    (public.is_user_active() and surveyor_id = auth.uid())
    or public.can_manage_survey(survey_id)
  );

drop policy if exists "responses_select" on public.responses;
create policy "responses_select" on public.responses
  for select to authenticated
  using (
    (public.is_user_active() and surveyor_id = auth.uid())
    or public.is_org_member(organization_id)
  );

drop policy if exists "responses_insert" on public.responses;
create policy "responses_insert" on public.responses
  for insert to authenticated
  with check (
    public.is_org_manager(organization_id)
    or (
      public.is_user_active()
      and surveyor_id = auth.uid()
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

drop policy if exists "responses_update" on public.responses;
create policy "responses_update" on public.responses
  for update to authenticated
  using (
    public.is_org_manager(organization_id)
    or (public.is_user_active() and surveyor_id = auth.uid() and status = 'en_curso')
  )
  with check (
    public.is_org_manager(organization_id)
    or (public.is_user_active() and surveyor_id = auth.uid())
  );

drop policy if exists "zone_quotas_select" on public.survey_zone_quotas;
create policy "zone_quotas_select" on public.survey_zone_quotas
  for select to authenticated
  using (
    exists (
      select 1 from public.survey_assignments a
      where a.id = assignment_id
        and (
          (public.is_user_active() and a.surveyor_id = auth.uid())
          or public.can_manage_survey(a.survey_id)
        )
    )
  );

drop policy if exists "ai_calls_select" on public.ai_calls;
create policy "ai_calls_select" on public.ai_calls
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id is not null and public.is_org_member(organization_id))
    or (public.is_user_active() and created_by = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 2c. Guard de perfiles: `is_active` solo lo cambia la administracion central
--
-- Contexto en el que `auth.uid()` es null (service role, SQL editor,
-- migraciones) o el usuario es super_admin activo: sin restricciones.
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  -- coalesce: sin rol vigente (usuario bloqueado) las comparaciones dan NULL y
  -- `if not NULL` no entra, lo que dejaria pasar el cambio.
  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id then
    if not coalesce(
      public.app_role() = 'org_admin'
      and public.app_org() = old.organization_id
      and new.organization_id = old.organization_id
      and new.role not in ('super_admin', 'surveyor')
      and old.role <> 'surveyor',
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

-- ----------------------------------------------------------------------------
-- 3. Los perfiles los crea el trigger o la service role, no los clientes
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (public.is_super_admin());

-- ============================================================================
-- Revision manual despues de aplicar (SQL editor, no forma parte de la migracion)
--
-- Cuentas que pudieron crearse con el registro abierto:
--
--   select p.role, p.email, p.organization_id, p.created_at,
--          u.last_sign_in_at, u.raw_user_meta_data->>'role' as rol_en_metadata
--   from public.profiles p
--   join auth.users u on u.id = p.id
--   where p.role = 'super_admin' or u.raw_user_meta_data ? 'role'
--   order by p.created_at;
--
-- Si un super_admin queda bloqueado por error (ahora ningun cliente puede
-- reactivarlo), se recupera desde el SQL editor:
--
--   update public.profiles set is_active = true where email = '...';
--
-- Los usuarios que ya estaban bloqueados quedan cortados por RLS, pero su
-- login en Supabase Auth sigue vigente. Se bloquean tambien desde la app
-- (Reactivar y volver a Bloquear) para que Auth les niegue el ingreso.
-- ============================================================================
