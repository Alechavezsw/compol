-- Los informes del radar de conversación no cuelgan de una encuesta.
alter table public.ai_reports alter column survey_id drop not null;
