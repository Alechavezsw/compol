-- El politico lee resultados y el pulso de redes. No escribe ni ve el equipo.

create or replace function public.can_read_survey(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_user_active() and exists (
    select 1
    from public.surveys s
    where s.id = sid
      and (
        public.is_super_admin()
        or s.organization_id = public.app_org()
        or exists (
          select 1 from public.survey_assignments a
          where a.survey_id = s.id and a.surveyor_id = auth.uid()
        )
      )
  );
$fn$;

create or replace function public.owns_response(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.responses r
    where r.id = rid
      and (
        (public.is_user_active() and r.surveyor_id = auth.uid())
        or public.is_org_member(r.organization_id)
        or (public.app_role() = 'politico' and public.app_org() = r.organization_id)
      )
  );
$fn$;

drop policy if exists "responses_select" on public.responses;
create policy "responses_select" on public.responses
  for select to authenticated
  using (
    (public.is_user_active() and surveyor_id = auth.uid())
    or public.is_org_member(organization_id)
    or (public.app_role() = 'politico' and public.app_org() = organization_id)
  );

drop policy if exists "social_posts_select" on public.social_posts;
create policy "social_posts_select" on public.social_posts
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    or (public.app_role() = 'politico' and public.app_org() = organization_id)
  );
