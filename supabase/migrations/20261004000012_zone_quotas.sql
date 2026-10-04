-- Cuotas por departamento / barrio, encima de la asignación del encuestador.
create table public.survey_zone_quotas (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.survey_assignments(id) on delete cascade,
  zone          text not null,
  quota         integer not null check (quota >= 1 and quota <= 5000),
  unique (assignment_id, zone)
);
create index zone_quotas_assignment_idx on public.survey_zone_quotas(assignment_id);

alter table public.survey_zone_quotas enable row level security;

create policy "zone_quotas_select" on public.survey_zone_quotas
  for select to authenticated
  using (
    exists (
      select 1 from public.survey_assignments a
      where a.id = assignment_id
        and (a.surveyor_id = auth.uid() or public.can_manage_survey(a.survey_id))
    )
  );

create policy "zone_quotas_write" on public.survey_zone_quotas
  for all to authenticated
  using (
    exists (
      select 1 from public.survey_assignments a
      where a.id = assignment_id
        and public.can_manage_survey(a.survey_id)
    )
  )
  with check (
    exists (
      select 1 from public.survey_assignments a
      where a.id = assignment_id
        and public.can_manage_survey(a.survey_id)
    )
  );
