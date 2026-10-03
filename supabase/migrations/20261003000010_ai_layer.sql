-- ============================================================================
-- 10 - Capa de IA en Supabase (Gemini + JEV / TypeSafe)
--
-- Las claves viven en secretos de Edge Functions, no en el cliente.
-- ai_calls registra cada invocación para auditoría (sin prompts ni textos).
-- ============================================================================

create table if not exists public.ai_calls (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  action          text not null check (action in ('classify', 'report', 'ask', 'status')),
  provider        text not null check (provider in ('gemini', 'jev', 'none')),
  model           text,
  status          text not null default 'ok' check (status in ('ok', 'error')),
  error_message   text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists ai_calls_org_idx on public.ai_calls(organization_id, created_at desc);
create index if not exists ai_calls_action_idx on public.ai_calls(action, created_at desc);

alter table public.ai_calls enable row level security;

create policy "ai_calls_select" on public.ai_calls
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id is not null and public.is_org_member(organization_id))
    or created_by = auth.uid()
  );

-- Solo la función Edge (service role) escribe. Ningún cliente inserta a mano.
create policy "ai_calls_write" on public.ai_calls
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
