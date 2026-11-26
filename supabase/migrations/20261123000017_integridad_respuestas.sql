-- ============================================================================
-- 17 - Integridad de respuestas y cierre de permisos innecesarios
--
-- 1. Una entrevista de campo no se guarda dos veces: indice UNICO sobre
--    (encuesta, huella del envio) para el canal campo. La app ya hacia
--    "consultar y despues insertar", lo que deja una ventana de carrera si el
--    telefono reenvia mientras el primer envio sigue en curso. El indice la cierra.
--    No aplica a la web: ahi la huella depende del dispositivo y, con
--    "una respuesta por dispositivo" apagado, se repite a proposito.
--
-- 2. Las respuestas no cambian de encuesta, organizacion, encuestador ni canal.
--    La policy responses_update dejaba a un encuestador reasignar su propia
--    entrevista a cualquier encuesta u organizacion (solo exigia
--    surveyor_id = auth.uid() en el WITH CHECK). Ahora lo impide un trigger.
--
-- 3. Una respuesta (answers) solo puede apuntar a una pregunta de la misma
--    encuesta que su entrevista.
--
-- 4. organizations: solo la administracion central las modifica. La app nunca
--    escribe organizaciones desde el panel del cliente, pero org_update dejaba a
--    un org_admin cambiar el estado de su propia organizacion (por ejemplo,
--    reactivarse si estaba suspendida) o su slug llamando a la API.
--
-- 5. responses.ip_hash: huella anonima de la conexion (hash con sal, no la IP)
--    para limitar respuestas web por conexion con una cuenta en la base y no en
--    la memoria de cada instancia serverless.
--
-- ANTES de aplicar el indice unico, revisar duplicados existentes (SQL editor):
--
--   select survey_id, respondent_hash, count(*)
--   from public.responses
--   where respondent_hash is not null and channel = 'campo'
--   group by 1, 2 having count(*) > 1;
--
-- Si devuelve filas, hay que resolverlas (conservar una y borrar las demas)
-- antes de correr esta migracion: el CREATE UNIQUE INDEX falla con duplicados.
--
-- ORDEN DE DESPLIEGUE: aplicar esta migracion ANTES de publicar la version de la
-- app que escribe `ip_hash`, o el envio de la encuesta web falla.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Idempotencia de las entrevistas de campo
-- ----------------------------------------------------------------------------
create unique index if not exists responses_campo_respondent_uniq
  on public.responses (survey_id, respondent_hash)
  where respondent_hash is not null and channel = 'campo';

-- ----------------------------------------------------------------------------
-- 5. Huella de conexion para el limite de la encuesta web
-- ----------------------------------------------------------------------------
alter table public.responses
  add column if not exists ip_hash text;

create index if not exists responses_web_ip_idx
  on public.responses (survey_id, ip_hash, submitted_at desc)
  where ip_hash is not null;

-- ----------------------------------------------------------------------------
-- 2. Columnas de identidad de la respuesta, inmutables
--
-- Contextos sin usuario (service role, SQL editor, migraciones) y la
-- administracion central quedan exentos. Tambien se permite que surveyor_id
-- pase a NULL: es lo que hace la FK `on delete set null` al borrar un perfil.
-- ----------------------------------------------------------------------------
create or replace function public.guard_response_identity()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.survey_id is distinct from old.survey_id
     or new.organization_id is distinct from old.organization_id
     or new.channel is distinct from old.channel
     or (new.surveyor_id is distinct from old.surveyor_id and new.surveyor_id is not null) then
    raise exception 'Una respuesta no puede cambiar de encuesta, organizacion, canal ni encuestador';
  end if;

  return new;
end;
$fn$;

drop trigger if exists responses_guard_identity on public.responses;
create trigger responses_guard_identity
  before update on public.responses
  for each row execute function public.guard_response_identity();

-- ----------------------------------------------------------------------------
-- 3. La pregunta de una respuesta pertenece a la encuesta de la entrevista
--
-- SECURITY DEFINER para no depender de que quien escribe pueda leer la
-- pregunta por RLS: la regla es de integridad, no de permisos.
-- ----------------------------------------------------------------------------
create or replace function public.guard_answer_question()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (
    select 1
    from public.responses r
    join public.questions q on q.survey_id = r.survey_id
    where r.id = new.response_id
      and q.id = new.question_id
  ) then
    raise exception 'La pregunta no pertenece a la encuesta de esta respuesta';
  end if;
  return new;
end;
$fn$;

drop trigger if exists answers_guard_question on public.answers;
create trigger answers_guard_question
  before insert or update of response_id, question_id on public.answers
  for each row execute function public.guard_answer_question();

-- ----------------------------------------------------------------------------
-- 4. organizations: escribe solo la administracion central
-- ----------------------------------------------------------------------------
drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
