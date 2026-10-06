-- El alta de encuestas fallaba: el INSERT...RETURNING pedía una SELECT
-- que no veía la fila nueva, y el WITH CHECK era demasiado estrecho.
drop policy if exists surveys_select on public.surveys;
create policy surveys_select on public.surveys
  for select to authenticated
  using (public.is_org_member(organization_id) or public.can_read_survey(id));

drop policy if exists surveys_insert on public.surveys;
create policy surveys_insert on public.surveys
  for insert to authenticated
  with check (
    public.is_org_manager(organization_id)
    or (
      created_by = auth.uid()
      and organization_id = public.app_org()
      and public.app_role() = 'org_admin'
    )
  );
