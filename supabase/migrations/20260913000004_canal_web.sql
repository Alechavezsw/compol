-- ============================================================================
-- 04 - Canal web: encuestas autoadministradas por link o widget embebido
--
-- Una encuesta con web_enabled = true y estado 'activa' se puede responder en
-- /e/<public_token>, que es también lo que carga el widget (iframe) en sitios
-- de terceros. Las respuestas web no tienen encuestador: channel = 'web'.
--
-- Seguridad: el público NO recibe permisos nuevos por RLS. La página pública y
-- el envío corren en el servidor con la service role, validan el token, el
-- estado de la encuesta y las respuestas contra el cuestionario, y aplican
-- límites de frecuencia. Así una clave anon filtrada no habilita leer ni
-- escribir nada.
-- ============================================================================

alter table public.surveys
  add column if not exists web_enabled  boolean not null default false,
  add column if not exists public_token text unique,
  add column if not exists web_settings jsonb not null default '{}'::jsonb;

alter table public.responses
  add column if not exists channel         text not null default 'campo',
  add column if not exists source_url      text,
  add column if not exists respondent_hash text;

alter table public.responses
  drop constraint if exists responses_channel_check;
alter table public.responses
  add constraint responses_channel_check check (channel in ('campo', 'web'));

-- Búsqueda de duplicados por dispositivo.
create index if not exists responses_respondent_idx
  on public.responses (survey_id, respondent_hash)
  where respondent_hash is not null;

-- Un token público corto y difícil de adivinar para cada encuesta web.
create or replace function public.ensure_public_token()
returns trigger language plpgsql as $fn$
begin
  if new.web_enabled and new.public_token is null then
    new.public_token := encode(gen_random_bytes(9), 'base64');
    new.public_token := translate(new.public_token, '+/=', '-_');
  end if;
  return new;
end;
$fn$;

drop trigger if exists surveys_public_token on public.surveys;
create trigger surveys_public_token
  before insert or update of web_enabled on public.surveys
  for each row execute function public.ensure_public_token();
