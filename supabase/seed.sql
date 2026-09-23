-- ============================================================================
-- Datos de demostracion
--
-- Ejecutar DESPUES de las migraciones, en el SQL Editor de Supabase.
-- Crea usuarios reales en auth.users. Password de todos: Demo1234!
--
--   admin@encuestadora.app        super_admin  (administracion central)
--   direccion@sanrafael.gob.ar    org_admin    (cliente: Municipalidad)
--   analista@sanrafael.gob.ar     org_analyst  (cliente: solo lectura)
--   campo1@encuestadora.app       surveyor     (encuestador)
--   campo2@encuestadora.app       surveyor     (encuestador)
--
-- NO usar en produccion.
-- ============================================================================

do $seed$
declare
  v_org_muni  uuid := '11111111-1111-4111-8111-111111111111';
  v_org_uni   uuid := '22222222-2222-4222-8222-222222222222';
  v_admin     uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_dir       uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  v_analista  uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  v_campo1    uuid := 'aaaaaaaa-0000-4000-8000-000000000004';
  v_campo2    uuid := 'aaaaaaaa-0000-4000-8000-000000000005';
  v_project   uuid := '33333333-3333-4333-8333-333333333333';
  v_survey    uuid := '44444444-4444-4444-8444-444444444444';
  v_survey2   uuid := '44444444-4444-4444-8444-444444444445';
  r           record;
  v_q         uuid;
begin
  -- --------------------------------------------------------------------------
  -- Usuarios de auth
  -- --------------------------------------------------------------------------
  for r in
    select * from (values
      (v_admin,    'admin@encuestadora.app',      'Laura Giménez',   'super_admin'),
      (v_dir,      'direccion@sanrafael.gob.ar',  'Martín Robledo',  'org_admin'),
      (v_analista, 'analista@sanrafael.gob.ar',   'Sofía Paredes',   'org_analyst'),
      (v_campo1,   'campo1@encuestadora.app',     'Diego Ferreyra',  'surveyor'),
      (v_campo2,   'campo2@encuestadora.app',     'Carla Ibáñez',    'surveyor')
    ) as t(id, email, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email, crypt('Demo1234!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name, 'role', r.role),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id::text, r.id,
      jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict do nothing;
  end loop;

  -- --------------------------------------------------------------------------
  -- Organizaciones
  -- --------------------------------------------------------------------------
  insert into public.organizations (id, name, slug, type, status, contact_email, region, brand_color)
  values
    (v_org_muni, 'Municipalidad de San Rafael', 'san-rafael', 'gobierno', 'activa',
     'direccion@sanrafael.gob.ar', 'Mendoza', '#1e40af'),
    (v_org_uni,  'Universidad Nacional del Litoral', 'unl', 'institucion', 'prueba',
     'rectorado@unl.edu.ar', 'Santa Fe', '#0d9488')
  on conflict (id) do nothing;

  -- --------------------------------------------------------------------------
  -- Perfiles (el trigger ya los creo; aca los completamos)
  -- --------------------------------------------------------------------------
  update public.profiles set role = 'super_admin', full_name = 'Laura Giménez', organization_id = null where id = v_admin;
  update public.profiles set role = 'org_admin',   full_name = 'Martín Robledo', organization_id = v_org_muni where id = v_dir;
  update public.profiles set role = 'org_analyst', full_name = 'Sofía Paredes',  organization_id = v_org_muni where id = v_analista;
  update public.profiles set role = 'surveyor',    full_name = 'Diego Ferreyra', organization_id = v_org_muni where id = v_campo1;
  update public.profiles set role = 'surveyor',    full_name = 'Carla Ibáñez',   organization_id = v_org_muni where id = v_campo2;

  -- --------------------------------------------------------------------------
  -- Proyecto y encuestas
  -- --------------------------------------------------------------------------
  insert into public.projects (id, organization_id, name, description, created_by)
  values (v_project, v_org_muni, 'Monitor de Opinión Pública 2026',
          'Serie trimestral de medición de percepción ciudadana.', v_dir)
  on conflict (id) do nothing;

  insert into public.surveys (id, organization_id, project_id, title, description, status,
                              target_responses, starts_at, ends_at, geography, methodology, created_by)
  values
    (v_survey, v_org_muni, v_project,
     'Percepción Ciudadana — Ola 3 (Agosto 2026)',
     'Medición de imagen de gestión, prioridades vecinales y satisfacción con servicios públicos.',
     'activa', 600, now() - interval '20 days', now() + interval '10 days',
     'San Rafael, Mendoza', 'Presencial cara a cara, muestreo por cuotas', v_dir),
    (v_survey2, v_org_muni, v_project,
     'Percepción Ciudadana — Ola 4 (Noviembre 2026)',
     'Próxima ola del monitor trimestral.',
     'borrador', 600, null, null, 'San Rafael, Mendoza',
     'Presencial cara a cara, muestreo por cuotas', v_dir)
  on conflict (id) do nothing;

  -- --------------------------------------------------------------------------
  -- Preguntas
  -- --------------------------------------------------------------------------
  if not exists (select 1 from public.questions where survey_id = v_survey) then

    insert into public.questions (id, survey_id, position, type, text, section, is_required)
    values (gen_random_uuid(), v_survey, 1, 'si_no',
            '¿Reside actualmente en el municipio de San Rafael?', 'Filtro', true);

    insert into public.questions (survey_id, position, type, text, section, is_required)
    values (v_survey, 2, 'opcion_unica', '¿En qué rango de edad se encuentra?', 'Perfil', true)
    returning id into v_q;
    insert into public.question_options (question_id, position, label) values
      (v_q, 1, '18 a 29 años'), (v_q, 2, '30 a 44 años'),
      (v_q, 3, '45 a 59 años'), (v_q, 4, '60 años o más');

    insert into public.questions (survey_id, position, type, text, section, is_required)
    values (v_survey, 3, 'opcion_unica', 'Género', 'Perfil', true)
    returning id into v_q;
    insert into public.question_options (question_id, position, label) values
      (v_q, 1, 'Femenino'), (v_q, 2, 'Masculino'), (v_q, 3, 'Otro / Prefiero no responder');

    insert into public.questions (survey_id, position, type, text, section, is_required)
    values (v_survey, 4, 'opcion_unica',
            '¿Cómo evalúa la gestión del gobierno municipal?', 'Gestión', true)
    returning id into v_q;
    insert into public.question_options (question_id, position, label) values
      (v_q, 1, 'Muy buena'), (v_q, 2, 'Buena'), (v_q, 3, 'Regular'),
      (v_q, 4, 'Mala'), (v_q, 5, 'Muy mala'), (v_q, 6, 'No sabe / No contesta');

    insert into public.questions (survey_id, position, type, text, help_text, section, is_required)
    values (v_survey, 5, 'opcion_multiple',
            '¿Cuáles son los principales problemas del municipio?',
            'Puede marcar hasta tres opciones.', 'Agenda', true)
    returning id into v_q;
    insert into public.question_options (question_id, position, label) values
      (v_q, 1, 'Seguridad'), (v_q, 2, 'Salud'), (v_q, 3, 'Empleo'),
      (v_q, 4, 'Transporte público'), (v_q, 5, 'Estado de las calles'),
      (v_q, 6, 'Recolección de residuos'), (v_q, 7, 'Educación'), (v_q, 8, 'Alumbrado público');

    insert into public.questions (survey_id, position, type, text, section, is_required, min_value, max_value)
    values (v_survey, 6, 'escala',
            'Del 1 al 10, ¿qué tan satisfecho está con los servicios públicos?',
            'Servicios', true, 1, 10);

    insert into public.questions (survey_id, position, type, text, section, is_required)
    values (v_survey, 7, 'opcion_unica',
            '¿Por qué medio se informa principalmente sobre temas locales?', 'Medios', true)
    returning id into v_q;
    insert into public.question_options (question_id, position, label) values
      (v_q, 1, 'Redes sociales'), (v_q, 2, 'Televisión'), (v_q, 3, 'Radio'),
      (v_q, 4, 'Portales de noticias'), (v_q, 5, 'Comentarios de vecinos');

    insert into public.questions (survey_id, position, type, text, section, is_required)
    values (v_survey, 8, 'si_no',
            '¿Considera que su barrio mejoró durante el último año?', 'Gestión', true);

    insert into public.questions (survey_id, position, type, text, section, is_required, min_value, max_value)
    values (v_survey, 9, 'numero', 'Edad exacta del encuestado', 'Perfil', false, 16, 99);

    insert into public.questions (survey_id, position, type, text, section, is_required)
    values (v_survey, 10, 'texto_largo',
            '¿Qué le pediría a la gestión municipal para el próximo año?', 'Abierta', false);
  end if;

  -- --------------------------------------------------------------------------
  -- Asignaciones
  -- --------------------------------------------------------------------------
  insert into public.survey_assignments (survey_id, surveyor_id, quota, zone) values
    (v_survey, v_campo1, 300, 'Zona Centro y Norte'),
    (v_survey, v_campo2, 300, 'Zona Sur y Oeste')
  on conflict (survey_id, surveyor_id) do nothing;

  -- --------------------------------------------------------------------------
  -- Respuestas simuladas
  -- --------------------------------------------------------------------------
  if not exists (select 1 from public.responses where survey_id = v_survey) then
    insert into public.responses (survey_id, organization_id, surveyor_id, status, zone,
                                  duration_seconds, started_at, submitted_at)
    select
      v_survey, v_org_muni,
      (array[v_campo1, v_campo2])[1 + floor(random() * 2)::int],
      'completada',
      (array['Centro','Norte','Sur','Este','Oeste'])[1 + floor(random() * 5)::int],
      280 + floor(random() * 520)::int,
      now() - (floor(random() * 19) || ' days')::interval,
      now() - (floor(random() * 19) || ' days')::interval
    from generate_series(1, 384);

    -- Opcion unica y si/no: distribucion sesgada hacia las primeras opciones
    insert into public.answers (response_id, question_id, option_ids, value_text)
    select r.id, q.id,
           case when q.type = 'opcion_unica' then
             array[(select o.id from public.question_options o
                     where o.question_id = q.id
                     order by o.position
                     offset floor(power(random(), 1.6) *
                            (select count(*) from public.question_options o2 where o2.question_id = q.id))::int
                     limit 1)]
           else '{}'::uuid[] end,
           case when q.type = 'si_no'
                then (case when random() < 0.62 then 'si' else 'no' end)
                else null end
    from public.responses r
    join public.questions q on q.survey_id = v_survey
    where r.survey_id = v_survey and q.type in ('opcion_unica', 'si_no');

    -- Opcion multiple: entre 1 y 3 opciones
    insert into public.answers (response_id, question_id, option_ids)
    select r.id, q.id,
           array(select o.id from public.question_options o
                  where o.question_id = q.id
                  order by random() limit 1 + floor(random() * 3)::int)
    from public.responses r
    join public.questions q on q.survey_id = v_survey
    where r.survey_id = v_survey and q.type = 'opcion_multiple';

    -- Escala 1-10 y edad
    insert into public.answers (response_id, question_id, value_number)
    select r.id, q.id,
           case when q.type = 'escala'
                then 1 + floor(power(random(), 0.85) * 10)::int
                else 18 + floor(random() * 62)::int end
    from public.responses r
    join public.questions q on q.survey_id = v_survey
    where r.survey_id = v_survey and q.type in ('escala', 'numero');

    -- Respuestas abiertas (solo un tercio contesta)
    insert into public.answers (response_id, question_id, value_text)
    select r.id, q.id,
           (array[
             'Que arreglen las calles del barrio, hace años que están rotas.',
             'Más patrullaje nocturno, sobre todo en las plazas.',
             'Necesitamos más frecuencia de colectivos hacia el centro.',
             'Que mejoren la atención en el hospital y los turnos.',
             'Más programas para jóvenes y capacitación laboral.',
             'Que la recolección de residuos pase todos los días.',
             'Más luminarias LED, hay cuadras completas a oscuras.',
             'Está mejorando, pero falta que lleguen las obras a la periferia.',
             'Menos impuestos y más obra visible en los barrios.',
             'Espacios verdes cuidados y seguros para los chicos.'
           ])[1 + floor(random() * 10)::int]
    from public.responses r
    join public.questions q on q.survey_id = v_survey
    where r.survey_id = v_survey and q.type = 'texto_largo' and random() < 0.34;
  end if;
end
$seed$;
