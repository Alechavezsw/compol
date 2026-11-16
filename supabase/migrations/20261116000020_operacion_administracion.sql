-- La operacion del cliente (encuestas, informes, redes, proyectos, dirigentes)
-- la hace solo la administracion central. El usuario del cliente queda en lectura.

create or replace function public.is_org_manager(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_super_admin();
$fn$;

drop policy if exists surveys_insert on public.surveys;
drop policy if exists "surveys_insert" on public.surveys;
create policy surveys_insert on public.surveys
  for insert to authenticated
  with check (public.is_org_manager(organization_id));

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id then
    raise exception 'No tiene permisos para modificar rol u organizacion';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Solo la administracion central puede activar o bloquear usuarios';
  end if;

  return new;
end;
$fn$;
