-- ============================================================================
-- 03 - Lógica de cuestionario
--
-- questions.logic guarda los saltos y filtros en JSON:
--   { "show_if": { "question_id": "<uuid>", "values": ["<option_id>" | "si" | "no"] },
--     "end_if":  ["<option_id>" | "si" | "no"] }
--
-- show_if  -> la pregunta solo se hace si la respuesta a otra ANTERIOR coincide.
-- end_if   -> pregunta filtro: si la respuesta coincide, la entrevista se cierra
--             como 'descartada' (no entra en los resultados, sí en la incidencia).
--
-- Para opción múltiple, questions.max_value pasa a ser el tope de opciones
-- marcables. No hace falta columna nueva: la columna ya existía y no se usaba.
-- ============================================================================

alter table public.questions
  add column if not exists logic jsonb;

comment on column public.questions.logic is
  'Saltos y filtros: {"show_if":{"question_id":uuid,"values":[...]}, "end_if":[...]}';

-- Una respuesta descartada por filtro no debería quedar con respuestas a
-- preguntas que nunca se hicieron; el índice ayuda a los tableros que separan
-- completadas de descartadas por encuesta.
create index if not exists responses_survey_status_submitted_idx
  on public.responses (survey_id, status, submitted_at);

-- Las opciones "No sabe / No contesta" o "Ninguno" deberían ser excluyentes en
-- las preguntas de opción múltiple. Marcamos las existentes que lo parezcan.
update public.question_options
   set is_exclusive = true
 where is_exclusive = false
   and (label ilike 'no sabe%' or label ilike 'ns/nc%' or label ilike 'ninguno%'
        or label ilike 'ninguna%' or label ilike 'no contesta%');
