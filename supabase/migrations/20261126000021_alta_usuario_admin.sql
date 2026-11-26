-- Alta de usuarios desde la administración central, con la sesión del
-- super_admin. No usa la service role: auth.admin.createUser depende de
-- SUPABASE_SERVICE_ROLE_KEY y esa clave puede estar ausente o rechazada
-- ("Invalid API key") sin impedir el resto de la app.

create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_organization_id uuid,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $fn$
declare
  new_id uuid := gen_random_uuid();
  clean_email text := lower(trim(p_email));
  clean_name text := trim(p_full_name);
  clean_role public.user_role;
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'No autorizado';
  end if;

  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  if length(clean_name) < 3 then
    raise exception 'Ingresá el nombre y apellido';
  end if;

  begin
    clean_role := p_role::public.user_role;
  exception
    when invalid_text_representation then
      raise exception 'Rol inválido';
  end;

  if clean_role = 'super_admin' then
    p_organization_id := null;
  elsif p_organization_id is null
     or not exists (
       select 1 from public.organizations o where o.id = p_organization_id
     ) then
    raise exception 'Los roles de cliente y de campo necesitan una organización';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = clean_email) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', clean_name),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    false,
    false
  );

  insert into auth.identities (
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', clean_email, 'email_verified', true),
    'email',
    new_id::text,
    now(),
    now(),
    now()
  );

  update public.profiles
  set
    full_name = clean_name,
    email = clean_email,
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    role = clean_role,
    organization_id = p_organization_id
  where id = new_id;

  if not found then
    raise exception 'No se pudo completar el perfil';
  end if;

  return new_id;
end;
$fn$;

revoke all on function public.admin_create_user(text, text, text, text, uuid, text) from public;
revoke all on function public.admin_create_user(text, text, text, text, uuid, text) from anon;
grant execute on function public.admin_create_user(text, text, text, text, uuid, text) to authenticated;
