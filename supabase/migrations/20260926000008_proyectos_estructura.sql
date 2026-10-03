-- ============================================================================
-- 08 - Proyectos: línea de servicio
--
-- Un proyecto agrupa el trabajo que la consultora vende a un cliente (una o
-- varias olas de encuesta, un tracking, un monitor de gestión...). Clasificarlo
-- por línea de servicio permite reportar el portfolio real, no solo "encuestas".
-- ============================================================================

alter table public.projects
  add column if not exists service_line text not null default 'opinion_publica'
  check (service_line in (
    'opinion_publica', 'tracking', 'monitor_gestion', 'inteligencia_territorial',
    'banco_dirigentes', 'cualitativo', 'laboratorio_opinion', 'radar_conversacion',
    'estudios_tematicos', 'flash'
  ));

create index if not exists projects_service_line_idx on public.projects(service_line);
