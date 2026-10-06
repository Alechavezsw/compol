alter table public.projects drop constraint if exists projects_service_line_check;

alter table public.projects
  add constraint projects_service_line_check
  check (service_line in (
    'opinion_publica',
    'tracking',
    'monitor_gestion',
    'inteligencia_territorial',
    'banco_dirigentes',
    'cualitativo',
    'laboratorio_opinion',
    'radar_conversacion',
    'estudios_tematicos',
    'flash',
    'otro'
  ));
